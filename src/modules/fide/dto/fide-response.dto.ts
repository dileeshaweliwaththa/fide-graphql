import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class FideResponse {
    @Field()
    id: number;
}
