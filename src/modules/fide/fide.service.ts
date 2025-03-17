import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CreateFideInput } from './dto/create-fide.input';
import { UpdateFideInput } from './dto/update-fide.input';
import { PlayerDTO, PlayerResponseDTO, PlayersDTO, PlayersResponseDTO } from './dto/player.dto';
import { HistoryEntry } from './dto/history-entry.dto';
import * as scraper from '../../scraper/functions';
import { PlayerInfo } from './dto/player-info.dto';
import { catchError, firstValueFrom } from 'rxjs';

@Injectable()
export class FideService {
  constructor(private httpService: HttpService) {}

  async getTopPlayers(limit: number = 100, includeHistory: boolean = false): Promise<PlayerDTO[]> {
    try {
      const response = await this.httpService.get('https://ratings.fide.com/top.phtml?list=open').toPromise();
      const htmlDoc = response?.data;

      let topPlayers = scraper.get_top_players(htmlDoc) as PlayerDTO[];
      topPlayers = topPlayers.slice(0, limit);

      if (!includeHistory) return topPlayers;

      for (const player of topPlayers) {
        const profileUrl = `https://ratings.fide.com/profile/${player.fide_id}`;
        const profileResponse = await this.httpService.get(profileUrl).toPromise();
        const profileHtml = profileResponse?.data;
        
        player.history = scraper.get_player_history(profileHtml);
      }

      return topPlayers;
    } catch (error) {
      throw new Error(`Failed to fetch top players: ${error.message}`);
    }
  }

  async getPlayerHistory(fideId: string): Promise<HistoryEntry[]> {
    try {
      const profileUrl = `https://ratings.fide.com/profile/${fideId}`;
      const response = await this.httpService.get(profileUrl).toPromise();
      const htmlDoc = response?.data;
      
      return scraper.get_player_history(htmlDoc);
    } catch (error) {
      throw new Error(`Failed to fetch player history: ${error.message}`);
    }
  }

  /**
   * Fetch player information by FIDE ID
   * @param fideId - FIDE ID of the player
   * @param includeHistory - Whether to include rating history
   * @returns Player information response
   */
  async getPlayerInfo(fideId: string, includeHistory: boolean = false): Promise<PlayerResponseDTO> {
    try {
      const playerInfo = await this.fetchPlayerData(fideId, includeHistory);
      
      return {
        success: true,
        message: 'Player information fetched successfully',
        data: playerInfo,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: `Failed to fetch player info: ${error.message}`,
        data: null
      });
    }
  }

  /**
   * Fetch information for multiple players by their FIDE IDs
   * @param fideIds - Array of FIDE IDs
   * @returns Multiple players information response
   */
  async getPlayersInfo(fideIds: string[]): Promise<PlayersResponseDTO> {
    try {
      const playerPromises = fideIds.map(fideId => this.fetchPlayerData(fideId, false)
        .catch(error => {
          console.error(`Failed to fetch player ${fideId}:`, error);
          return { fide_id: fideId, name: 'Error fetching player' } as PlayerDTO;
        })
      );

      const playersData = await Promise.all(playerPromises);
      return { 
        success: true,
        message: 'Players information fetched successfully',
        data: playersData,
      };
    } catch (error) {
      throw new NotFoundException({
        success: false,
        message: `Failed to fetch players info: ${error.message}`,
        data: null
      });
    }
  }

  /**
   * Private helper method to fetch player data from FIDE website
   * @param fideId - FIDE ID of the player
   * @param includeHistory - Whether to include rating history
   * @returns Player data
   */
  private async fetchPlayerData(fideId: string, includeHistory: boolean): Promise<PlayerDTO> {
    const profileUrl = `https://ratings.fide.com/profile/${fideId}`;
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(profileUrl).pipe(
          catchError(error => {
            throw new Error(`HTTP request failed: ${error.message}`);
          })
        )
      );
      
      const htmlDoc = response?.data;
      const playerInfo = scraper.get_player_info(htmlDoc) as PlayerDTO;
      
      // Check if player info is null (player not found)
      if (playerInfo === null) {
        throw new Error(`Player with ID ${fideId} not found`);
      }
      
      // Now it's safe to add history since we know playerInfo is not null
      if (includeHistory) {
        playerInfo.history = scraper.get_player_history(htmlDoc);
      }
      
      return playerInfo;
    } catch (error) {
      throw new Error(`Failed to fetch data for player ID ${fideId}: ${error.message}`);
    }
  }
}
