import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PlayerDTO, PlayerResponseDTO, PlayersResponseDTO } from './dto/player.dto';
import { HistoryEntry } from './dto/history-entry.dto';
import * as scraper from '../../scraper/functions';
import { ProxyManagerService } from '../../utils/proxy-manager.service';

// ─── Cache TTLs ───────────────────────────────────────────────────────────────
// FIDE ratings update once a month so aggressive caching is safe.
const TTL_PLAYER_INFO_MS   = 30 * 60 * 1_000;  // 30 min
const TTL_PLAYER_HIST_MS   = 60 * 60 * 1_000;  // 1 hour
const TTL_TOP_PLAYERS_MS   = 10 * 60 * 1_000;  // 10 min

// Maximum concurrent profile fetches for getTopPlayers(includeHistory)
// Keeps FIDE from rate-limiting while still being parallel
const HISTORY_BATCH_SIZE = 5;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class FideService {
  private readonly logger = new Logger(FideService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly proxyManager: ProxyManagerService) {}

  // ─── Cache helpers ────────────────────────────────────────────────────────

  private cacheGet<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this.cache.delete(key); return null; }
    return entry.data;
  }

  private cacheSet<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  // ─── Public methods ───────────────────────────────────────────────────────

  async getTopPlayers(limit: number = 100, includeHistory: boolean = false): Promise<PlayerDTO[]> {
    const cacheKey = `top:${limit}:${includeHistory}`;
    const cached = this.cacheGet<PlayerDTO[]>(cacheKey);
    if (cached) return cached;

    const response = await this.proxyManager.fideGet(
      'https://ratings.fide.com/top.phtml?list=open',
    );

    let topPlayers = (scraper.get_top_players(response.data) as PlayerDTO[]).slice(0, limit);

    if (includeHistory) {
      // Fetch history in parallel batches to avoid hammering FIDE
      for (let i = 0; i < topPlayers.length; i += HISTORY_BATCH_SIZE) {
        const batch = topPlayers.slice(i, i + HISTORY_BATCH_SIZE);
        await Promise.all(
          batch.map(async player => {
            const profileUrl = `https://ratings.fide.com/profile/${player.fide_id}`;
            const profileResponse = await this.proxyManager.fideGet(profileUrl);
            player.history = scraper.get_player_history(profileResponse.data);
          }),
        );
      }
    }

    this.cacheSet(cacheKey, topPlayers, TTL_TOP_PLAYERS_MS);
    return topPlayers;
  }

  async getPlayerHistory(fideId: string): Promise<HistoryEntry[]> {
    const cacheKey = `hist:${fideId}`;
    const cached = this.cacheGet<HistoryEntry[]>(cacheKey);
    if (cached) return cached;

    const profileUrl = `https://ratings.fide.com/profile/${fideId}`;
    const response = await this.proxyManager.fideGet(profileUrl);
    const history = scraper.get_player_history(response.data);

    this.cacheSet(cacheKey, history, TTL_PLAYER_HIST_MS);
    return history;
  }

  async getPlayerInfo(
    fideId: string,
    includeHistory: boolean = false,
  ): Promise<PlayerResponseDTO> {
    try {
      const playerInfo = await this.fetchPlayerData(fideId, includeHistory);
      return { success: true, message: 'Player information fetched successfully', data: playerInfo };
    } catch (error) {
      this.logger.error(
        `getPlayerInfo failed for ${fideId} via "${this.proxyManager.activeLabel}": ${error?.message}`,
      );
      return { success: false, message: `Failed to fetch player info: ${error?.message}`, data: undefined };
    }
  }

  async getPlayersInfo(fideIds: string[]): Promise<PlayersResponseDTO> {
    // All IDs fetched concurrently — dedup in ProxyManager handles same-ID bursts
    const playersData = await Promise.all(
      fideIds.map(fideId =>
        this.fetchPlayerData(fideId, false).catch(error => {
          this.logger.error(`Failed to fetch player ${fideId}: ${error.message}`);
          return { fide_id: fideId, name: 'Error fetching player' } as PlayerDTO;
        }),
      ),
    );
    return { success: true, message: 'Players information fetched successfully', data: playersData };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async fetchPlayerData(fideId: string, includeHistory: boolean): Promise<PlayerDTO> {
    const cacheKey = `player:${fideId}:${includeHistory}`;
    const cached = this.cacheGet<PlayerDTO>(cacheKey);
    if (cached) return cached;

    const profileUrl = `https://ratings.fide.com/profile/${fideId}`;
    const response = await this.proxyManager.fideGet(profileUrl);
    const htmlDoc = response.data;

    const playerInfo = scraper.get_player_info(htmlDoc) as PlayerDTO;
    if (playerInfo === null) throw new NotFoundException(`Player with ID ${fideId} not found`);

    if (includeHistory) playerInfo.history = scraper.get_player_history(htmlDoc);

    this.cacheSet(cacheKey, playerInfo, TTL_PLAYER_INFO_MS);
    return playerInfo;
  }
}
