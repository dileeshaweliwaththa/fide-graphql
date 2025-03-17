import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CreateFideInput } from './dto/create-fide.input';
import { UpdateFideInput } from './dto/update-fide.input';
import { PlayerDTO, PlayerResponseDTO, PlayersDTO, PlayersResponseDTO } from './dto/player.dto';
import { HistoryEntry } from './dto/history-entry.dto';
import * as scraper from '../../scraper/functions';
import { PlayerInfo } from './dto/player-info.dto';

@Injectable()
export class FideService {
  constructor(private httpService: HttpService) {}

  async getTopPlayers(limit: number = 100, includeHistory: boolean = false): Promise<PlayerDTO[]> {
    try {
      const response = await this.httpService.get('https://ratings.fide.com/top.phtml?list=open').toPromise();
      const htmlDoc = response?.data;
      console.log(htmlDoc);

      let topPlayers = scraper.get_top_players(htmlDoc) as PlayerDTO[];
      topPlayers = topPlayers.slice(0, limit);
console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',topPlayers);
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

  async getPlayerInfo(fideId: string, includeHistory: boolean = false): Promise<PlayerResponseDTO> {
    try {
      const profileUrl = `https://ratings.fide.com/profile/${fideId}`;
      const response = await this.httpService.get(profileUrl).toPromise();
      const htmlDoc = response?.data;
      
      console.log('XXXXXXXXxxxx',htmlDoc);

      const playerInfo = scraper.get_player_info(htmlDoc) as PlayerDTO;
      console.log('XXXXXXXXxxxx',playerInfo);
      if (!includeHistory) return {
        success: true,
        message: 'Player information fetched successfully',
        data: playerInfo,
      };;
      
      playerInfo.history = scraper.get_player_history(htmlDoc);
      
      return {
        success: true,
        message: 'Player information fetched successfully',
        data: playerInfo,
      };
    } catch (error) {
      throw new Error(`Failed to fetch player info: ${error.message}`);
    }
  }

  async getPlayersInfo(fideIds: string[]): Promise<PlayersResponseDTO> {
    try {
      const playerPromises = fideIds.map(async (fideId) => {
        try {
          const profileUrl = `https://ratings.fide.com/profile/${fideId}`;
          const response = await this.httpService.get(profileUrl).toPromise();
          const htmlDoc = response?.data;
          
          const playerInfo = scraper.get_player_info(htmlDoc) as PlayerDTO;
          return playerInfo;
        } catch (error) {
          console.error(`Failed to fetch player ${fideId}:`, error);
          // Return a placeholder instead of throwing, to prevent Promise.all from failing
          return { fide_id: fideId, name: 'Error fetching player' } as PlayerDTO;
        }
      });

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

}
