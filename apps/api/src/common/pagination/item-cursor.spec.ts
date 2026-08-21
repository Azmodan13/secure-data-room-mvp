import { BadRequestException } from '@nestjs/common';
import { decodeItemCursor, encodeItemCursor } from './item-cursor';

describe('item cursor', () => {
  const id = '10000000-0000-4000-8000-000000000001';

  it('round-trips a size-descending cursor', () => {
    const encoded = encodeItemCursor({
      kind: 'file',
      sortBy: 'size',
      sortOrder: 'desc',
      sortValue: '2048',
      id,
    });

    expect(
      decodeItemCursor(encoded, { sortBy: 'size', sortOrder: 'desc' }),
    ).toEqual({
      kind: 'file',
      kindRank: 1,
      sortBy: 'size',
      sortOrder: 'desc',
      sortValue: '2048',
      id,
    });
  });

  it('rejects reusing a cursor with another sorting mode', () => {
    const encoded = encodeItemCursor({
      kind: 'folder',
      sortBy: 'name',
      sortOrder: 'asc',
      sortValue: 'legal',
      id,
    });

    expect(() =>
      decodeItemCursor(encoded, { sortBy: 'createdAt', sortOrder: 'desc' }),
    ).toThrow(BadRequestException);
  });
});
