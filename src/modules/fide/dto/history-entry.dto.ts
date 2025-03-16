import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class HistoryEntry {
  @Field()
  date?: string;

  @Field(() => Int)
  rating?: number;

  @Field(() => Int, { nullable: true })
  games?: number;
}
