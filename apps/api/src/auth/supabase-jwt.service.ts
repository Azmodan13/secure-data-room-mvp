import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthIdentity } from './auth-identity.type';

type JoseModule = typeof import('jose');
type RemoteJwkSet = ReturnType<JoseModule['createRemoteJWKSet']>;

@Injectable()
export class SupabaseJwtService {
  private readonly issuer: string;
  private readonly audience: string;
  private jwks?: RemoteJwkSet;

  constructor(config: ConfigService) {
    this.issuer = config
      .getOrThrow<string>('SUPABASE_JWT_ISSUER')
      .replace(/\/$/, '');

    this.audience = config.getOrThrow<string>('SUPABASE_JWT_AUDIENCE');
  }

  async verify(token: string): Promise<AuthIdentity> {
    try {
      const { createRemoteJWKSet, jwtVerify } = await import('jose');

      this.jwks ??= createRemoteJWKSet(
        new URL(`${this.issuer}/.well-known/jwks.json`),
      );

      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string'
      ) {
        throw new UnauthorizedException(
          'Access token is missing identity claims.',
        );
      }

      const metadata =
        typeof payload.user_metadata === 'object' &&
        payload.user_metadata !== null
          ? (payload.user_metadata as Record<string, unknown>)
          : {};

      const displayName =
        typeof metadata.full_name === 'string'
          ? metadata.full_name
          : typeof metadata.name === 'string'
            ? metadata.name
            : null;

      return {
        authUserId: payload.sub,
        email: payload.email.trim().toLowerCase(),
        displayName,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}
