import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class ChessPuzzle {
  @Field(() => Int)
  id: number;

  @Field()
  puzzle_id: string;

  @Field()
  fen: string;

  @Field()
  moves: string;

  @Field(() => Int)
  rating: number;

  @Field(() => Int)
  rating_deviation: number;

  @Field(() => Int)
  popularity: number;

  @Field(() => Int)
  nb_plays: number;

  @Field(() => [String])
  themes: string[];

  @Field({ nullable: true })
  game_url?: string;

  @Field(() => [String], { nullable: true })
  opening_tags?: string[];
}
