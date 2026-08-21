import { BadRequestException } from '@nestjs/common';

export type ItemKind = 'folder' | 'file';
export type ItemSortBy = 'name' | 'createdAt' | 'size';
export type SortOrder = 'asc' | 'desc';

type ItemCursorPayload = {
  version: 2;
  kind: ItemKind;
  sortBy: ItemSortBy;
  sortOrder: SortOrder;
  sortValue: string;
  id: string;
};

export type ItemCursorPosition = Omit<ItemCursorPayload, 'version'> & {
  kindRank: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeItemCursor(
  position: Omit<ItemCursorPosition, 'kindRank'>,
): string {
  return Buffer.from(
    JSON.stringify({ version: 2, ...position } satisfies ItemCursorPayload),
  ).toString('base64url');
}

export function decodeItemCursor(
  cursor: string,
  expected: { sortBy: ItemSortBy; sortOrder: SortOrder },
): ItemCursorPosition {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (typeof parsed !== 'object' || parsed === null)
      throw new Error('Invalid cursor payload');
    const value = parsed as Record<string, unknown>;
    if (
      value.version !== 2 ||
      (value.kind !== 'folder' && value.kind !== 'file') ||
      value.sortBy !== expected.sortBy ||
      value.sortOrder !== expected.sortOrder ||
      typeof value.sortValue !== 'string' ||
      typeof value.id !== 'string' ||
      !UUID_PATTERN.test(value.id)
    )
      throw new Error('Invalid cursor fields');
    return {
      kind: value.kind,
      kindRank: value.kind === 'folder' ? 0 : 1,
      sortBy: expected.sortBy,
      sortOrder: expected.sortOrder,
      sortValue: value.sortValue,
      id: value.id,
    };
  } catch {
    throw new BadRequestException('Item pagination cursor is not valid.');
  }
}
