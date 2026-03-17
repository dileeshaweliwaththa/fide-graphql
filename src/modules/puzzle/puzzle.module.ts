import { Module } from '@nestjs/common';
import { PuzzleService } from './puzzle.service';
import { PuzzleResolver } from './puzzle.resolver';

@Module({
  providers: [PuzzleResolver, PuzzleService],
  exports: [PuzzleService],
})
export class PuzzleModule {}
