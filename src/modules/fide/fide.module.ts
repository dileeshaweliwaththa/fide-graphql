import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FideService } from './fide.service';
import { FideResolver } from './fide.resolver';

@Module({
  imports: [HttpModule],
  providers: [FideResolver, FideService],
})
export class FideModule {}
