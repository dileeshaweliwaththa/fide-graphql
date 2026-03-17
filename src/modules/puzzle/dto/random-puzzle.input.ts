import { InputType, Field, Int } from '@nestjs/graphql';
import { DifficultyTier } from './filter-puzzles.input';

@InputType()
export class RandomPuzzleInput {
  /** Number of puzzles to return (max 10, default 1) */
  @Field(() => Int, { nullable: true }) count?: number;
  /**
   * Shorthand difficulty tier. Translates to a rating range.
   * Stacks with minRating / maxRating — the tighter bound always wins.
   */
  @Field(() => DifficultyTier, { nullable: true }) difficulty?: DifficultyTier;
  /** Minimum rating — overrides the tier lower bound if tighter */
  @Field(() => Int, { nullable: true }) minRating?: number;
  /** Maximum rating — overrides the tier upper bound if tighter */
  @Field(() => Int, { nullable: true }) maxRating?: number;
  /** All supplied theme tags must be present */
  @Field(() => [String], { nullable: true }) themes?: string[];
}
