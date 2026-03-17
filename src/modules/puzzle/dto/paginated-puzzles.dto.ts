import { ObjectType, Field, Int } from '@nestjs/graphql';
import { ChessPuzzle } from '../entities/chess-puzzle.entity';

@ObjectType()
export class PaginatedPuzzles {
  @Field(() => [ChessPuzzle])
  items: ChessPuzzle[];

  @Field(() => Boolean)
  hasNextPage: boolean;

  /** Pass this value as `cursor` to fetch the next page. Absent on last page. */
  @Field({ nullable: true })
  nextCursor?: string;
}
