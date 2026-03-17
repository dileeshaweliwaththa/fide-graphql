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

registerEnumType(PuzzleSortField, { name: 'PuzzleSortField' });
registerEnumType(SortOrder, { name: 'SortOrder' });

@InputType()
export class FilterPuzzlesInput {
  /** Minimum rating (inclusive) */
  @Field(() => Int, { nullable: true }) minRating?: number;
  /** Maximum rating (inclusive) */
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
