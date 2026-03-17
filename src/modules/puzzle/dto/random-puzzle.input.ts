import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class RandomPuzzleInput {
  /** Number of puzzles to return (max 10, default 1) */
  @Field(() => Int, { nullable: true }) count?: number;
  /** Minimum rating */
  @Field(() => Int, { nullable: true }) minRating?: number;
  /** Maximum rating */
  @Field(() => Int, { nullable: true }) maxRating?: number;
  /** All supplied theme tags must be present */
  @Field(() => [String], { nullable: true }) themes?: string[];
}
