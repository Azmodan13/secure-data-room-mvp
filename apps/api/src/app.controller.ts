import { Controller, Get } from '@nestjs/common';
@Controller()
export class AppController {
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
