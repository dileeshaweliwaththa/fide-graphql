import { ObjectType, Field } from '@nestjs/graphql';
import { ThemeWithCount } from './theme-with-count.dto';

@ObjectType()
export class PaginatedThemes {
  @Field(() => [ThemeWithCount])
  items: ThemeWithCount[];

  @Field(() => Boolean)
  hasNextPage: boolean;

  /** Pass as `cursor` to fetch the next page. Absent on last page. */
  @Field({ nullable: true })
  nextCursor?: string;
}
