import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { FideModule } from './modules/fide/fide.module';
import { HealthController } from './health/health.controller';
import { join } from 'path';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: true,
      autoSchemaFile: join(process.cwd(), 'src/graphql-schema.gql'),
    }),
    FideModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
