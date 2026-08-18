import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  getHealth() {
    return {
      data: {
        service: 'secure-data-room-api',
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
