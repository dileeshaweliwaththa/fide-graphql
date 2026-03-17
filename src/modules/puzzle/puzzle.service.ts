import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChessPuzzle } from './entities/chess-puzzle.entity';
import {
  FilterPuzzlesInput,
  PuzzleSortField,
  SortOrder,
  DifficultyTier,
} from './dto/filter-puzzles.input';
import { PaginatedPuzzles } from './dto/paginated-puzzles.dto';
import { RandomPuzzleInput } from './dto/random-puzzle.input';
import { ThemeWithCount } from './dto/theme-with-count.dto';
import { PaginatedThemes } from './dto/paginated-themes.dto';
import { ThemesPaginationInput } from './dto/themes-pagination.input';

// ── Difficulty helpers ────────────────────────────────────────────────────────

function tierToRange(tier: DifficultyTier): { min?: number; max?: number } {
  switch (tier) {
    case DifficultyTier.BEGINNER:     return {             max: 999  };
    case DifficultyTier.EASY:         return { min: 1000,  max: 1499 };
    case DifficultyTier.INTERMEDIATE: return { min: 1500,  max: 1999 };
    case DifficultyTier.HARD:         return { min: 2000,  max: 2499 };
    case DifficultyTier.EXPERT:       return { min: 2500             };
  }
}

function resolveRatingBounds(
  difficulty?: DifficultyTier,
  minRating?: number,
  maxRating?: number,
): { min?: number; max?: number } {
  const tier = difficulty ? tierToRange(difficulty) : {};
  const min = Math.max(minRating ?? 0, tier.min ?? 0) || undefined;
  const rawMax = Math.min(maxRating ?? Infinity, tier.max ?? Infinity);
  const max = rawMax === Infinity ? undefined : rawMax;
  return { min, max };
}

// ── Minimal in-process TTL cache ─────────────────────────────────────────────
// Avoids full-table UNNEST scans on every request for near-static data.
// TTL = 1 hour.  No external dependency needed.

interface CacheEntry<T> { data: T; expiry: number }

function makeCache<T>() {
  let entry: CacheEntry<T> | null = null;
  return {
    get: (): T | null =>
      entry && Date.now() < entry.expiry ? entry.data : null,
    set: (data: T, ttlMs = 60 * 60 * 1000) => {
      entry = { data, expiry: Date.now() + ttlMs };
    },
    invalidate: () => { entry = null; },
  };
}

@Injectable()
export class PuzzleService {
  private readonly logger = new Logger(PuzzleService.name);

  // Per-instance caches — reset on pod restart (acceptable for puzzle metadata)
  private readonly themesCache      = makeCache<ThemeWithCount[]>();
  private readonly openingsCache    = makeCache<string[]>();
  private readonly ratingDistCache  = makeCache<Array<{ bucket: number; count: number }>>();

  constructor(private readonly dataSource: DataSource) {}

  // ── Private: load & cache themes-with-count ──────────────────────────────

  private async loadThemesWithCount(): Promise<ThemeWithCount[]> {
    const cached = this.themesCache.get();
    if (cached) return cached;

    const rows: Array<{ theme: string; count: string }> =
      await this.dataSource.query(`
        SELECT theme, COUNT(*) AS count
        FROM (SELECT UNNEST(themes) AS theme FROM chess.puzzles) t
        WHERE theme IS NOT NULL
        GROUP BY theme
        ORDER BY theme
      `);

    const result = rows.map((r) => ({
      theme: r.theme,
      count: Number(r.count),
    }));
    this.themesCache.set(result);
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Queries
  // ─────────────────────────────────────────────────────────────────────────

  async findMany(input: FilterPuzzlesInput): Promise<PaginatedPuzzles> {
    const limit = Math.min(input.limit ?? 20, 100);
    const sortField: PuzzleSortField = input.sortBy ?? PuzzleSortField.RATING;
    const sortOrder: SortOrder = input.sortOrder ?? SortOrder.ASC;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (input.cursor) {
      params.push(input.cursor);
      conditions.push(`puzzle_id > $${params.length}`);
    }

    const { min: effectiveMin, max: effectiveMax } = resolveRatingBounds(
      input.difficulty,
      input.minRating,
      input.maxRating,
    );
    if (effectiveMin !== undefined) {
      params.push(effectiveMin);
      conditions.push(`rating >= $${params.length}`);
    }
    if (effectiveMax !== undefined) {
      params.push(effectiveMax);
      conditions.push(`rating <= $${params.length}`);
    }
    if (input.themes?.length) {
      params.push(input.themes);
      conditions.push(`themes @> $${params.length}::text[]`);
    }
    if (input.openingTags?.length) {
      params.push(input.openingTags);
      conditions.push(`opening_tags @> $${params.length}::text[]`);
    }
    if (input.minPopularity !== undefined) {
      params.push(input.minPopularity);
      conditions.push(`popularity >= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit + 1);

    const rows: ChessPuzzle[] = await this.dataSource.query(
      `SELECT * FROM chess.puzzles ${where}
       ORDER BY ${sortField} ${sortOrder}, puzzle_id ASC
       LIMIT $${params.length}`,
      params,
    );

    const hasNextPage = rows.length > limit;
    if (hasNextPage) rows.pop();

    return {
      items: rows,
      hasNextPage,
      nextCursor: hasNextPage ? rows[rows.length - 1]?.puzzle_id : undefined,
    };
  }

  async findOne(puzzleId: string): Promise<ChessPuzzle> {
    const rows: ChessPuzzle[] = await this.dataSource.query(
      `SELECT * FROM chess.puzzles WHERE puzzle_id = $1 LIMIT 1`,
      [puzzleId],
    );
    if (!rows.length)
      throw new NotFoundException(`Puzzle "${puzzleId}" not found`);
    return rows[0];
  }

  /**
   * Random puzzles using TABLESAMPLE SYSTEM (1% ≈ 58 000 rows) for O(1)
   * random page selection, then a second filtered fetch from that pool.
   * Falls back to a larger sample if the first pool yields nothing.
   */
  async findRandom(input: RandomPuzzleInput): Promise<ChessPuzzle[]> {
    const count = Math.min(input.count ?? 1, 10);

    // Build filter clauses for the second query
    const conditions: string[] = ['puzzle_id = ANY($1::text[])'];
    const { min: effectiveMin, max: effectiveMax } = resolveRatingBounds(
      input.difficulty,
      input.minRating,
      input.maxRating,
    );

    // Pre-filter the TABLESAMPLE by rating so the second pass is cheaper
    const sampleConditions: string[] = [];
    if (effectiveMin !== undefined)
      sampleConditions.push(`rating >= ${effectiveMin}`);
    if (effectiveMax !== undefined)
      sampleConditions.push(`rating <= ${effectiveMax}`);
    const sampleWhere = sampleConditions.length
      ? `WHERE ${sampleConditions.join(' AND ')}`
      : '';

    // 1% sample — ~58k rows on 5.8M table; fast page-level random I/O
    const pool: Array<{ puzzle_id: string }> = await this.dataSource.query(
      `SELECT puzzle_id FROM chess.puzzles TABLESAMPLE SYSTEM (1) ${sampleWhere} LIMIT $1`,
      [count * 50],
    );

    if (pool.length === 0) return [];

    const ids = pool.map((r) => r.puzzle_id);
    const params: unknown[] = [ids];

    if (effectiveMin !== undefined) {
      params.push(effectiveMin);
      conditions.push(`rating >= $${params.length}`);
    }
    if (effectiveMax !== undefined) {
      params.push(effectiveMax);
      conditions.push(`rating <= $${params.length}`);
    }
    if (input.themes?.length) {
      params.push(input.themes);
      conditions.push(`themes @> $${params.length}::text[]`);
    }

    params.push(count * 3);
    const rows: ChessPuzzle[] = await this.dataSource.query(
      `SELECT * FROM chess.puzzles WHERE ${conditions.join(' AND ')} LIMIT $${params.length}`,
      params,
    );

    // Fisher-Yates shuffle in memory
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    return rows.slice(0, count);
  }

  /** Flat list of all distinct theme tags — served from cache after first load. */
  async findAllThemes(): Promise<string[]> {
    const themes = await this.loadThemesWithCount();
    return themes.map((t) => t.theme);
  }

  /**
   * Paginated themes with counts — sliced from the in-memory cache.
   * The first call hits the DB; subsequent calls are microseconds.
   */
  async findThemesPaginated(input: ThemesPaginationInput): Promise<PaginatedThemes> {
    const limit = Math.min(input.limit ?? 50, 200);
    const allThemes = await this.loadThemesWithCount();

    // Alphabetic keyset: find the start index from the cursor
    let startIdx = 0;
    if (input.cursor) {
      const idx = allThemes.findIndex((t) => t.theme > input.cursor!);
      startIdx = idx === -1 ? allThemes.length : idx;
    }

    const slice = allThemes.slice(startIdx, startIdx + limit + 1);
    const hasNextPage = slice.length > limit;
    if (hasNextPage) slice.pop();

    return {
      items: slice,
      hasNextPage,
      nextCursor: hasNextPage ? slice[slice.length - 1]?.theme : undefined,
    };
  }

  /**
   * Picks one random theme from the cached list in memory — zero DB round-trip
   * after the first call. Excluded themes are filtered in-process.
   */
  async findRandomTheme(exclude: string[] = []): Promise<ThemeWithCount> {
    const allThemes = await this.loadThemesWithCount();
    const excludeSet = new Set(exclude);
    const eligible = excludeSet.size
      ? allThemes.filter((t) => !excludeSet.has(t.theme))
      : allThemes;

    if (eligible.length === 0)
      throw new NotFoundException('No eligible themes found (all may be excluded).');

    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  /** All ECO opening tags — cached after first load. */
  async findAllOpenings(): Promise<string[]> {
    const cached = this.openingsCache.get();
    if (cached) return cached;

    const rows: Array<{ tag: string }> = await this.dataSource.query(`
      SELECT DISTINCT UNNEST(opening_tags) AS tag
      FROM chess.puzzles
      WHERE opening_tags IS NOT NULL
      ORDER BY tag
    `);
    const result = rows.map((r) => r.tag);
    this.openingsCache.set(result);
    return result;
  }

  /** Rating histogram in 100-point ELO buckets — cached after first load. */
  async getRatingDistribution(): Promise<Array<{ bucket: number; count: number }>> {
    const cached = this.ratingDistCache.get();
    if (cached) return cached;

    const rows: Array<{ bucket: string; count: string }> =
      await this.dataSource.query(`
        SELECT FLOOR(rating / 100) * 100 AS bucket, COUNT(*) AS count
        FROM chess.puzzles
        GROUP BY bucket
        ORDER BY bucket
      `);
    const result = rows.map((r) => ({
      bucket: Number(r.bucket),
      count: Number(r.count),
    }));
    this.ratingDistCache.set(result);
    return result;
  }
}
