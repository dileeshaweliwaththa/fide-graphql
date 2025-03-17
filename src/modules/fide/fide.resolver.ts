import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { FideService } from './fide.service';
import { CreateFideInput } from './dto/create-fide.input';
import { UpdateFideInput } from './dto/update-fide.input';
import { FideResponse } from './dto/fide-response.dto';
import { PlayerDTO, PlayerResponseDTO, PlayersDTO, PlayersResponseDTO } from './dto/player.dto';
import { HistoryEntry } from './dto/history-entry.dto';
import { player, PlayerInfo } from './dto/player-info.dto';

@Resolver()
export class FideResolver {
  constructor(private readonly fideService: FideService) {}

  @Query(() => [PlayerDTO], { name: 'topPlayers' })
  getTopPlayers(
    @Args('limit', { type: () => Int, defaultValue: 100 }) limit: number,
    @Args('includeHistory', { type: () => Boolean, defaultValue: false }) includeHistory: boolean,
  ) {
    return this.fideService.getTopPlayers(limit, includeHistory);
  }

  @Query(() => [HistoryEntry], { name: 'playerHistory' })
  getPlayerHistory(
    @Args('fideId') fideId: string,
  ) {
    return this.fideService.getPlayerHistory(fideId);
  }

  /**
   * Resolver for fetching player info according to the FIDE ID
   * @param fideId - FIDE ID of the player
   * @param includeHistory - Flag to include player's history
   * @returns {Promise<PlayerResponseDTO>} - Player information
   */
  @Query(() => PlayerResponseDTO, { name: 'playerInfo' })
  async getPlayerInfo(
    @Args('fideId') fideId: string,
    @Args('includeHistory', { type: () => Boolean, defaultValue: false }) includeHistory: boolean,
  ): Promise<PlayerResponseDTO> {
    return await this.fideService.getPlayerInfo(fideId, includeHistory);
  }

  @Query(() => PlayersResponseDTO, { name: 'multiplePlayersInfo' })
  async getMultiplePlayersInfo(
    @Args('fideIds', { type: () => [String] }) fideIds: string[],
  ) {
    const result = await this.fideService.getPlayersInfo(fideIds);
    return result;
  }
}
