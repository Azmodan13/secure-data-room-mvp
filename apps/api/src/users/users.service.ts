import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AuthIdentity } from '../auth/auth-identity.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(identity: AuthIdentity): Promise<User> {
    const email = identity.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { authUserId: identity.authUserId },
    });

    if (!existing) {
      return this.prisma.user.create({
        data: {
          authUserId: identity.authUserId,
          email,
          displayName: identity.displayName,
        },
      });
    }

    if (
      existing.email === email &&
      existing.displayName === identity.displayName
    ) {
      return existing;
    }

    return this.prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        displayName: identity.displayName,
      },
    });
  }
}
