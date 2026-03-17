import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { PuzzleService } from './puzzle.service';
import { ChessPuzzle } from './entities/chess-puzzle.entity';
import { FilterPuzzlesInput } from './dto/filter-puzzles.input';
import { PaginatedPuzzles } from './dto/paginated-puzzles.dto';
import { RandomPuzzleInput } from './dto/random-puzzle.input';
import { ThemesPaginationInput } from './dto/themes-pagination.input';
import { PaginatedThemes } from './dto/paginated-themes.dto';
import { ThemeWithCount } from './dto/theme-with-count.dto';

@Resolver(() => ChessPuzzle)
export class PuzzleResolver {
  constructor(private readonly puzzleService: PuzzleService) {}

  // ──────────────────────────────────────────────────────────────────────────
  //  Queries
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Paginated list of puzzles with optional rating/theme/opening filters.
   * Uses cursor-based pagination for O(log n) performance on large datasets.
   *
   * @example
   * query {
   *   chessPuzzles(filter: { minRating: 1200, maxRating: 1500, themes: ["fork"], limit: 10 }) {
   *     items { puzzle_id fen moves rating themes }
   *     hasNextPage
   *     nextCursor
   *   }
   * }
   */
  @Query(() => PaginatedPuzzles, { name: 'chessPuzzles' })
  findMany(
    @Args('filter', { type: () => FilterPuzzlesInput, nullable: true })
    filter: FilterPuzzlesInput = {},
  ): Promise<PaginatedPuzzles> {
    return this.puzzleService.findMany(filter);
  }

  /**
   * Fetch a single puzzle by its Lichess puzzle_id (e.g. "00008").
   *
   * @example
   * query {
   *   chessPuzzle(puzzleId: "00sBO") {
   *     puzzle_id fen moves rating themes
   *   }
   * }
   */
  @Query(() => ChessPuzzle, { name: 'chessPuzzle' })
  findOne(
    @Args('puzzleId', { type: () => String }) puzzleId: string,
  ): Promise<ChessPuzzle> {
    return this.puzzleService.findOne(puzzleId);
  }

  /**
   * Return N random puzzles, optionally filtered by rating range and themes.
   *
   * @example
   * query {
   *   randomChessPuzzles(input: { count: 5, minRating: 1000, maxRating: 1400 }) {
   *     puzzle_id fen moves rating themes
   *   }
   * }
   */
  @Query(() => [ChessPuzzle], { name: 'randomChessPuzzles' })
  findRandom(
    @Args('input', { type: () => RandomPuzzleInput, nullable: true })
    input: RandomPuzzleInput = {},
  ): Promise<ChessPuzzle[]> {
    return this.puzzleService.findRandom(input);
  }

  /**
   * All distinct theme tags available in the database
   * (e.g. "crushing", "endgame", "fork", "mateIn2", …).
   *
   * @example
   * query { chessPuzzleThemes }
   */
  @Query(() => [String], { name: 'chessPuzzleThemes' })
  findAllThemes(): Promise<string[]> {
    return this.puzzleService.findAllThemes();
  }

  /**
   * Paginated themes list — each entry includes the theme name and
   * the number of puzzles that carry it, sorted alphabetically.
   *
   * Pass `nextCursor` from the previous response as `cursor` to advance pages.
   *
   * @example
   * query {
   *   chessPuzzleThemesPaginated(input: { limit: 20 }) {
   *     items { theme count }
   *     hasNextPage
   *     nextCursor
   *   }
   * }
   */
  @Query(() => PaginatedThemes, { name: 'chessPuzzleThemesPaginated' })
  findThemesPaginated(
    @Args('input', { type: () => ThemesPaginationInput, nullable: true })
    input: ThemesPaginationInput = {},
  ): Promise<PaginatedThemes> {
    return this.puzzleService.findThemesPaginated(input);
  }

  /**
   * Returns a single random theme with its puzzle count.
   *
   * Pass previously seen themes in `exclude` to guarantee a fresh pick.
   * Keep accumulating the returned theme names client-side and pass them
   * back on each call — once all themes are excluded a NotFoundException
   * is thrown so the client knows to reset the list.
   *
   * @example
   * query {
   *   randomChessPuzzleTheme(exclude: ["fork", "pin"]) {
   *     theme
   *     count
   *   }
   * }
   */
  @Query(() => ThemeWithCount, { name: 'randomChessPuzzleTheme' })
  findRandomTheme(
    @Args('exclude', { type: () => [String], nullable: true, defaultValue: [] })
    exclude: string[] = [],
  ): Promise<ThemeWithCount> {
    return this.puzzleService.findRandomTheme(exclude);
  }

  /**
   * All distinct ECO opening tags.
   *
   * @example
   * query { chessPuzzleOpenings }
   */
  @Query(() => [String], { name: 'chessPuzzleOpenings' })
  findAllOpenings(): Promise<string[]> {
    return this.puzzleService.findAllOpenings();
  }

  /**
   * Rating histogram in 100-point ELO buckets — useful for difficulty sliders.
   * Returns a JSON-stringified array of { bucket: number, count: number }.
   *
   * @example
   * query { chessPuzzleRatingDistribution }
   */
  @Query(() => String, { name: 'chessPuzzleRatingDistribution' })
  async getRatingDistribution(): Promise<string> {
    const dist = await this.puzzleService.getRatingDistribution();
    return JSON.stringify(dist);
  }
}
