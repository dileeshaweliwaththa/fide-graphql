import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { FideService } from './fide.service';
import { CreateFideInput } from './dto/create-fide.input';
import { UpdateFideInput } from './dto/update-fide.input';
import { FideResponse } from './dto/fide-response.dto';
import { Player, Players } from './dto/player.dto';
import { HistoryEntry } from './dto/history-entry.dto';
import { player, PlayerInfo } from './dto/player-info.dto';

@Resolver()
export class FideResolver {
  constructor(private readonly fideService: FideService) {}

  @Mutation(() => FideResponse)
  createFide(@Args('createFideInput') createFideInput: CreateFideInput) {
    return this.fideService.create(createFideInput);
  }

  @Query(() => [FideResponse], { name: 'fides' })
  findAll() {
    return this.fideService.findAll();
  }

  @Query(() => FideResponse, { name: 'fide' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.fideService.findOne(id);
  }

  @Mutation(() => FideResponse)
  updateFide(@Args('updateFideInput') updateFideInput: UpdateFideInput) {
    return this.fideService.update(updateFideInput.id, updateFideInput);
  }

  @Mutation(() => FideResponse)
  removeFide(@Args('id', { type: () => Int }) id: number) {
    return this.fideService.remove(id);
  }

  @Query(() => [Player], { name: 'topPlayers' })
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

  @Query(() => Player, { name: 'playerInfo' })
  getPlayerInfo(
    @Args('fideId') fideId: string,
    @Args('includeHistory', { type: () => Boolean, defaultValue: false }) includeHistory: boolean,
  ) {
    return this.fideService.getPlayerInfo(fideId, includeHistory);
  }

  @Query(() => Players, { name: 'multiplePlayersInfo' })
  async getMultiplePlayersInfo(
    @Args('fideIds', { type: () => [String] }) fideIds: string[],
  ) {
    const result = await this.fideService.getPlayersInfo(fideIds);
    return result;
  }
}
