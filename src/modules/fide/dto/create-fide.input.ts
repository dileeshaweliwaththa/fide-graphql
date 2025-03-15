import { InputType, Int, Field } from '@nestjs/graphql';

@InputType()
export class CreateFideInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
