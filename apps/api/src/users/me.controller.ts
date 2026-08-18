import { Controller, Get } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('me')
export class MeController {
  @Get()
  getMe(@CurrentUser() user: User) {
    return {
      data: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }
}
