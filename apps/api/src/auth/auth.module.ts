import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SupabaseJwtService } from './supabase-jwt.service';

@Module({
  imports: [UsersModule],
  providers: [
    SupabaseJwtService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [SupabaseJwtService],
})
export class AuthModule {}
