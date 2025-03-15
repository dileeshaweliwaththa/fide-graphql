import { CreateFideInput } from './create-fide.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateFideInput extends PartialType(CreateFideInput) {
  @Field(() => Int)
  id: number;
}
