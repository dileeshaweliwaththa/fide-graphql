import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PlayerDTO, PlayerResponseDTO, PlayersResponseDTO } from './dto/player.dto';
import { HistoryEntry } from './dto/history-entry.dto';
import * as scraper from '../../scraper/functions';
import { ProxyManagerService } from '../../utils/proxy-manager.service';

@Injectable()
export class FideService {
  private readonly logger = new Logger(FideService.name);

  constructor(private readonly proxyManager: ProxyManagerService) {}

  async getTopPlayers(limit: number = 100, includeHistory: boolean = false): Promise<PlayerDTO[]> {
    try {
      const response = await this.proxyManager.fideGet(
        'https://ratings.fide.com/top.phtml?list=open',
      );
      const htmlDoc = response?.data;

      let topPlayers = scraper.get_top_players(htmlDoc) as PlayerDTO[];
      topPlayers = topPlayers.slice(0, limit);

      if (!includeHistory) return topPlayers;

      for (const player of topPlayers) {
        const profileUrl = `https://ratings.fide.com/profile/${player.fide_id}`;
        const profileResponse = await this.proxyManager.fideGet(profileUrl);
        player.history = scraper.get_player_history(profileResponse?.data);
      }

      return topPlayers;
    } catch (error) {
      throw new Error(`Failed to fetch top players: ${error.message}`);
    }
  }

  async getPlayerHistory(fideId: string): Promise<HistoryEntry[]> {
    try {
      const profileUrl = `https://ratings.fide.com/profile/${fideId}`;
      const response = await this.proxyManager.fideGet(profileUrl);
      return scraper.get_player_history(response?.data);
    } catch (error) {
      throw new Error(`Failed to fetch player history: ${error.message}`);
    }
  }

  async getPlayerInfo(
    fideId: string,
    includeHistory: boolean = false,
  ): Promise<PlayerResponseDTO> {
    try {
      const playerInfo = await this.fetchPlayerData(fideId, includeHistory);
      return {
        success: true,
        message: 'Player information fetched successfully',
        data: playerInfo,
      };
    } catch (error) {
      this.logger.error(
        `getPlayerInfo failed for ${fideId} via proxy "${this.proxyManager.activeLabel}": ${error?.message}`,
      );
      return {
        success: false,
        message: `Failed to fetch player info: ${error?.message}`,
        data: undefined,
      };
    }
  }

  async getPlayersInfo(fideIds: string[]): Promise<PlayersResponseDTO> {
    try {
      const playerPromises = fideIds.map(fideId =>
        this.fetchPlayerData(fideId, false).catch(error => {
          this.logger.error(`Failed to fetch player ${fideId}: ${error.message}`);
          return { fide_id: fideId, name: 'Error fetching player' } as PlayerDTO;
        }),
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
        data: null,
      });
    }
  }

  private async fetchPlayerData(
    fideId: string,
    includeHistory: boolean,
  ): Promise<PlayerDTO> {
    const profileUrl = `https://ratings.fide.com/profile/${fideId}`;

    this.logger.debug(
      `Fetching player ${fideId} via proxy "${this.proxyManager.activeLabel}"`,
    );

    const response = await this.proxyManager.fideGet(profileUrl);
    const htmlDoc = response?.data;

    const playerInfo = scraper.get_player_info(htmlDoc) as PlayerDTO;
    if (playerInfo === null) {
      throw new NotFoundException(`Player with ID ${fideId} not found`);
    }

    if (includeHistory) {
      playerInfo.history = scraper.get_player_history(htmlDoc);
    }

    return playerInfo;
  }
}
