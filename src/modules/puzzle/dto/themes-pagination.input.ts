import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class ThemesPaginationInput {
  /** Page size (max 200, default 50) */
  @Field(() => Int, { nullable: true }) limit?: number;
  /** Opaque cursor (theme name) returned by the previous page */
  @Field({ nullable: true }) cursor?: string;
}
