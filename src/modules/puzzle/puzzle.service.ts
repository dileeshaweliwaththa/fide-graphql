import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChessPuzzle } from './entities/chess-puzzle.entity';
import {
  FilterPuzzlesInput,
  PuzzleSortField,
  SortOrder,
} from './dto/filter-puzzles.input';
import { PaginatedPuzzles } from './dto/paginated-puzzles.dto';
import { RandomPuzzleInput } from './dto/random-puzzle.input';
import { ThemeWithCount } from './dto/theme-with-count.dto';
import { PaginatedThemes } from './dto/paginated-themes.dto';
import { ThemesPaginationInput } from './dto/themes-pagination.input';

@Injectable()
export class PuzzleService {
  private readonly logger = new Logger(PuzzleService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ──────────────────────────────────────────────────────────────────────────
  //  Queries
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Cursor-based paginated list with optional filters.
   *
   * Uses cursor pagination instead of OFFSET to stay O(log n) on 5.8 M rows.
   */
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
    if (input.minRating !== undefined) {
      params.push(input.minRating);
      conditions.push(`rating >= $${params.length}`);
    }
    if (input.maxRating !== undefined) {
      params.push(input.maxRating);
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
    const order = `ORDER BY ${sortField} ${sortOrder}, puzzle_id ASC`;
    params.push(limit + 1);
    const limitClause = `LIMIT $${params.length}`;

    const rows: ChessPuzzle[] = await this.dataSource.query(
      `SELECT * FROM chess.puzzles ${where} ${order} ${limitClause}`,
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

  /**
   * Find a single puzzle by its Lichess puzzle_id (e.g. "00008").
   */
  async findOne(puzzleId: string): Promise<ChessPuzzle> {
    const rows: ChessPuzzle[] = await this.dataSource.query(
      `SELECT * FROM chess.puzzles WHERE puzzle_id = $1 LIMIT 1`,
      [puzzleId],
    );
    if (!rows.length) throw new NotFoundException(`Puzzle "${puzzleId}" not found`);
    return rows[0];
  }

  /**
   * Returns N random puzzles matching optional filters.
   *
   * Uses TABLESAMPLE SYSTEM for O(1) random page selection — avoids full
   * ORDER BY RANDOM() scan on 5.8 M rows.
   */
  async findRandom(input: RandomPuzzleInput): Promise<ChessPuzzle[]> {
    const count = Math.min(input.count ?? 1, 10);
    const samplePct = 0.05; // ~2 900 rows pool

    const pool: Array<{ puzzle_id: string }> = await this.dataSource.query(
      `SELECT puzzle_id FROM chess.puzzles TABLESAMPLE SYSTEM ($1) LIMIT $2`,
      [samplePct, count * 20],
    );

    if (pool.length === 0) return [];

    const ids = pool.map((r) => r.puzzle_id).slice(0, count * 10);

    const conditions: string[] = ['puzzle_id = ANY($1::text[])'];
    const params: unknown[] = [ids];

    if (input.minRating !== undefined) {
      params.push(input.minRating);
      conditions.push(`rating >= $${params.length}`);
    }
    if (input.maxRating !== undefined) {
      params.push(input.maxRating);
      conditions.push(`rating <= $${params.length}`);
    }
    if (input.themes?.length) {
      params.push(input.themes);
      conditions.push(`themes @> $${params.length}::text[]`);
    }

    params.push(count * 2);
    const rows: ChessPuzzle[] = await this.dataSource.query(
      `SELECT * FROM chess.puzzles WHERE ${conditions.join(' AND ')} LIMIT $${params.length}`,
      params,
    );

    // Fisher-Yates shuffle
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    return rows.slice(0, count);
  }

  /**
   * Returns all distinct theme tags (e.g. "crushing", "fork", "mateIn2").
   */
  async findAllThemes(): Promise<string[]> {
    const rows: Array<{ theme: string }> = await this.dataSource.query(`
      SELECT DISTINCT UNNEST(themes) AS theme
      FROM chess.puzzles
      ORDER BY theme
    `);
    return rows.map((r) => r.theme);
  }

  /**
   * Paginated list of themes with puzzle counts, sorted alphabetically.
   * Cursor is the theme name itself (alphabetic keyset pagination).
   */
  async findThemesPaginated(
    input: ThemesPaginationInput,
  ): Promise<PaginatedThemes> {
    const limit = Math.min(input.limit ?? 50, 200);

    // Build the WHERE clause for cursor
    const cursorClause = input.cursor
      ? `AND theme > $2`
      : '';
    const params: unknown[] = input.cursor
      ? [limit + 1, input.cursor]
      : [limit + 1];

    const rows: Array<{ theme: string; count: string }> =
      await this.dataSource.query(
        `
        SELECT theme, COUNT(*) AS count
        FROM (
          SELECT UNNEST(themes) AS theme FROM chess.puzzles
        ) t
        WHERE theme IS NOT NULL ${cursorClause}
        GROUP BY theme
        ORDER BY theme
        LIMIT $1
        `,
        params,
      );

    const hasNextPage = rows.length > limit;
    if (hasNextPage) rows.pop();

    const items: ThemeWithCount[] = rows.map((r) => ({
      theme: r.theme,
      count: Number(r.count),
    }));

    return {
      items,
      hasNextPage,
      nextCursor: hasNextPage ? items[items.length - 1]?.theme : undefined,
    };
  }

  /**
   * Returns one random theme, excluding any themes in the `exclude` list.
   * Throws NotFoundException if no eligible themes remain.
   */
  async findRandomTheme(exclude: string[] = []): Promise<ThemeWithCount> {
    const excludeClause =
      exclude.length > 0 ? `AND theme <> ALL($1::text[])` : '';
    const params: unknown[] = exclude.length > 0 ? [exclude] : [];

    const rows: Array<{ theme: string; count: string }> =
      await this.dataSource.query(
        `
        SELECT theme, COUNT(*) AS count
        FROM (
          SELECT UNNEST(themes) AS theme FROM chess.puzzles
        ) t
        WHERE theme IS NOT NULL ${excludeClause}
        GROUP BY theme
        ORDER BY RANDOM()
        LIMIT 1
        `,
        params,
      );

    if (rows.length === 0) {
      throw new NotFoundException(
        'No eligible themes found (all may be excluded).',
      );
    }

    return { theme: rows[0].theme, count: Number(rows[0].count) };
  }

  /**
   * Returns all distinct ECO opening tags.
   */
  async findAllOpenings(): Promise<string[]> {
    const rows: Array<{ tag: string }> = await this.dataSource.query(`
      SELECT DISTINCT UNNEST(opening_tags) AS tag
      FROM chess.puzzles
      WHERE opening_tags IS NOT NULL
      ORDER BY tag
    `);
    return rows.map((r) => r.tag);
  }

  /**
   * Rating distribution in 100-point ELO buckets.
   * Useful for building difficulty-slider UIs.
   */
  async getRatingDistribution(): Promise<Array<{ bucket: number; count: number }>> {
    const rows: Array<{ bucket: string; count: string }> =
      await this.dataSource.query(`
        SELECT
          FLOOR(rating / 100) * 100 AS bucket,
          COUNT(*) AS count
        FROM chess.puzzles
        GROUP BY bucket
        ORDER BY bucket
      `);
    return rows.map((r) => ({
      bucket: Number(r.bucket),
      count: Number(r.count),
    }));
  }


}
