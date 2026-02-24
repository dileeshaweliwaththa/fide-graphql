import { Module } from '@nestjs/common';
import { FideService } from './fide.service';
import { FideResolver } from './fide.resolver';
import { ProxyManagerService } from '../../utils/proxy-manager.service';

@Module({
  providers: [FideResolver, FideService, ProxyManagerService],
  exports: [ProxyManagerService], // expose to AppModule for health endpoint
})
export class FideModule {}
