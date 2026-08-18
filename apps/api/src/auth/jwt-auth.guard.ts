import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './authenticated-request.type';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SupabaseJwtService } from './supabase-jwt.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: SupabaseJwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!match?.[1]) {
      throw new UnauthorizedException('Bearer access token is required.');
    }

    const identity = await this.jwt.verify(match[1]);
    request.user = await this.users.resolve(identity);

    return true;
  }
}
