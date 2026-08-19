import { BadRequestException } from '@nestjs/common';

type CursorPayload = {
  version: 1;
  id: string;
  createdAt: string;
};

export type CursorPosition = {
  id: string;
  createdAt: Date;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeCursor(position: CursorPosition): string {
  const payload: CursorPayload = {
    version: 1,
    id: position.id,
    createdAt: position.createdAt.toISOString(),
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor: string): CursorPosition {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid cursor payload');
    }

    const payload = parsed as Record<string, unknown>;

    if (
      payload.version !== 1 ||
      typeof payload.id !== 'string' ||
      !UUID_PATTERN.test(payload.id) ||
      typeof payload.createdAt !== 'string'
    ) {
      throw new Error('Invalid cursor fields');
    }

    const createdAt = new Date(payload.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      throw new Error('Invalid cursor date');
    }

    return {
      id: payload.id,
      createdAt,
    };
  } catch {
    throw new BadRequestException('Pagination cursor is not valid.');
  }
}
