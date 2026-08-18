import type { User } from '@prisma/client';
import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  user: User;
};
