import { Controller, Get } from '@nestjs/common';
import { ProxyManagerService } from '../utils/proxy-manager.service';

@Controller('health')
export class HealthController {
  constructor(private readonly proxyManager: ProxyManagerService) {}

  @Get()
  check() {
    const proxy = this.proxyManager.getStatus();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      proxy,
    };
  }
}
