import { BadRequestException } from '@nestjs/common';

export type ItemKind = 'folder' | 'file';

type ItemCursorPayload = {
  version: 1;
  kind: ItemKind;
  normalizedName: string;
  id: string;
};

export type ItemCursorPosition = {
  kind: ItemKind;
  kindRank: number;
  normalizedName: string;
  id: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeItemCursor(
  position: Omit<ItemCursorPosition, 'kindRank'>,
): string {
  const payload: ItemCursorPayload = {
    version: 1,
    kind: position.kind,
    normalizedName: position.normalizedName,
    id: position.id,
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeItemCursor(cursor: string): ItemCursorPosition {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid cursor payload');
    }

    const payload = parsed as Record<string, unknown>;

    if (
      payload.version !== 1 ||
      (payload.kind !== 'folder' && payload.kind !== 'file') ||
      typeof payload.normalizedName !== 'string' ||
      typeof payload.id !== 'string' ||
      !UUID_PATTERN.test(payload.id)
    ) {
      throw new Error('Invalid cursor fields');
    }

    return {
      kind: payload.kind,
      kindRank: payload.kind === 'folder' ? 0 : 1,
      normalizedName: payload.normalizedName,
      id: payload.id,
    };
  } catch {
    throw new BadRequestException('Item pagination cursor is not valid.');
  }
}
