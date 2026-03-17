import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class ThemeWithCount {
  @Field()
  theme: string;

  @Field(() => Int)
  count: number;
}
