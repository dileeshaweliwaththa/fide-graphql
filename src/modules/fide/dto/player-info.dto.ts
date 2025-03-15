import { Field, ObjectType } from '@nestjs/graphql';
import { HistoryEntry } from './history-entry.dto';

@ObjectType() 
export class player {
  @Field(() => [PlayerInfo], { nullable: true })
  playerInfo?: PlayerInfo[];
}

@ObjectType()
export class PlayerInfo {
  @Field()
  fideId?: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  federation?: string;

  @Field({ nullable: true })
  birthYear?: number;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  rating?: number;

  @Field(() => [HistoryEntry], { nullable: true })
  history?: HistoryEntry[];
}
