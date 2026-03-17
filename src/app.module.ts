import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FideModule } from './modules/fide/fide.module';
import { PuzzleModule } from './modules/puzzle/puzzle.module';
import { HealthController } from './health/health.controller';
import { join } from 'path';

@Module({
  imports: [
    // ── Config (reads .env) ──────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ── GraphQL ──────────────────────────────────────────────────────────────
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: true,
      autoSchemaFile: join(process.cwd(), 'src/graphql-schema.gql'),
    }),

    // ── PostgreSQL via TypeORM (credentials from .env) ───────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST', '20.198.23.172'),
        port: cfg.get<number>('DB_PORT', 6543),
        database: cfg.get<string>('DB_DATABASE', 'postgres'),
        username: cfg.get<string>('DB_USERNAME', 'postgres.upviewadmin'),
        password: cfg.get<string>('DB_PASSWORD'),
        synchronize: false,   // no managed entities — raw SQL only
        logging: cfg.get<string>('DB_LOGGING') === 'true',
        entities: [],         // no TypeORM-managed entities
      }),
    }),

    // ── Feature modules ──────────────────────────────────────────────────────
    FideModule,
    PuzzleModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
