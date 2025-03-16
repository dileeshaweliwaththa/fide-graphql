import { Field, Int, ObjectType } from '@nestjs/graphql';
import { HistoryEntry } from './history-entry.dto';

@ObjectType()
export class Player {
  @Field()
  fide_id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  country?: string;
  
  @Field({ nullable: true })
  federation?: string;

  @Field({ nullable: true })
  birth_year?: number;

  @Field({ nullable: true })
  rating?: number;

  @Field({ nullable: true })
  sex?: string;

  @Field({ nullable: true })
  world_rank_active?: number;

  @Field({ nullable: true })
  world_rank_all?: number;

  @Field({ nullable: true })
  national_rank_active?: number;

  @Field({ nullable: true })
  national_rank_all?: number;

  @Field({ nullable: true })
  continental_rank_active?: number;

  @Field({ nullable: true })
  continental_rank_all?: number;

  @Field({ nullable: true })
  age?: number;

  @Field(() => [HistoryEntry], { nullable: true })
  history?: HistoryEntry[];
}

@ObjectType()
export class Players {
  @Field(() => [Player], { nullable: true })
  players?: Player[];
}
