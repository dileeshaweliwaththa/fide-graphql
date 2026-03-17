import { InputType, Field, Int } from '@nestjs/graphql';
import { registerEnumType } from '@nestjs/graphql';

export enum PuzzleSortField {
  RATING = 'rating',
  POPULARITY = 'popularity',
  NB_PLAYS = 'nb_plays',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

/**
 * Convenience difficulty tiers mapped to Lichess Glicko-2 rating ranges:
 *   BEGINNER    < 1000
 *   EASY        1000 – 1499
 *   INTERMEDIATE 1500 – 1999
 *   HARD        2000 – 2499
 *   EXPERT      2500+
 *
 * Stacks with explicit minRating / maxRating — the most restrictive value wins.
 */
export enum DifficultyTier {
  BEGINNER = 'BEGINNER',
  EASY = 'EASY',
  INTERMEDIATE = 'INTERMEDIATE',
  HARD = 'HARD',
  EXPERT = 'EXPERT',
}

registerEnumType(PuzzleSortField, { name: 'PuzzleSortField' });
registerEnumType(SortOrder, { name: 'SortOrder' });
registerEnumType(DifficultyTier, {
  name: 'DifficultyTier',
  description:
    'Puzzle difficulty based on Lichess Glicko-2 rating. ' +
    'BEGINNER <1000 · EASY 1000-1499 · INTERMEDIATE 1500-1999 · HARD 2000-2499 · EXPERT 2500+',
});

@InputType()
export class FilterPuzzlesInput {
  /**
   * Shorthand difficulty tier. Translates to a rating range.
   * Stacks with minRating / maxRating — the tighter bound always wins.
   */
  @Field(() => DifficultyTier, { nullable: true }) difficulty?: DifficultyTier;
  /** Minimum rating (inclusive) — overrides the tier lower bound if tighter */
  @Field(() => Int, { nullable: true }) minRating?: number;
  /** Maximum rating (inclusive) — overrides the tier upper bound if tighter */
  @Field(() => Int, { nullable: true }) maxRating?: number;
  /** All supplied theme tags must be present on the puzzle */
  @Field(() => [String], { nullable: true }) themes?: string[];
  /** All supplied ECO opening tags must be present on the puzzle */
  @Field(() => [String], { nullable: true }) openingTags?: string[];
  /** Minimum popularity score */
  @Field(() => Int, { nullable: true }) minPopularity?: number;
  /** Opaque cursor returned by the previous page */
  @Field({ nullable: true }) cursor?: string;
  /** Page size (max 100, default 20) */
  @Field(() => Int, { nullable: true }) limit?: number;
  /** Sort field */
  @Field(() => PuzzleSortField, { nullable: true }) sortBy?: PuzzleSortField;
  /** Sort direction */
  @Field(() => SortOrder, { nullable: true }) sortOrder?: SortOrder;
}
