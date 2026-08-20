import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AccessPolicyService } from '../access-policy/access-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from './sharing.service';

type AsyncMock = jest.MockedFunction<(args: unknown) => Promise<unknown>>;

describe('SharingService', () => {
  let service: SharingService;
  let assertCanMutate: AsyncMock;
  let publicUpdateMany: AsyncMock;
  let publicCreate: AsyncMock;
  let publicFindFirst: AsyncMock;
  let requireRegisteredRecipient: AsyncMock;
  let grantFindFirst: AsyncMock;
  let grantCreate: AsyncMock;

  beforeEach(() => {
    assertCanMutate = jest.fn();
    publicUpdateMany = jest.fn();
    publicCreate = jest.fn().mockResolvedValue({
      id: 'link-1',
      createdAt: new Date('2026-08-21T10:00:00Z'),
    });
    publicFindFirst = jest.fn();
    requireRegisteredRecipient = jest.fn();
    grantFindFirst = jest.fn();
    grantCreate = jest.fn();

    const transaction = jest.fn((callback: (tx: unknown) => unknown) =>
      Promise.resolve(
        callback({
          publicLink: { updateMany: publicUpdateMany, create: publicCreate },
        }),
      ),
    );
    const prisma = {
      publicLink: { findFirst: publicFindFirst },
      shareGrant: { findFirst: grantFindFirst, create: grantCreate },
      $transaction: transaction,
    } as unknown as PrismaService;
    const accessPolicy = {
      assertCanMutate,
      requireRegisteredRecipient,
    } as unknown as AccessPolicyService;
    service = new SharingService(prisma, accessPolicy);
  });

  it('stores only a hash and revokes the prior public link', async () => {
    const result = await service.createPublicLink('owner-1', {
      targetType: 'folder',
      targetId: '10000000-0000-4000-8000-000000000001',
    });

    expect(result.token).toHaveLength(43);
    expect(publicUpdateMany).toHaveBeenCalledWith({
      where: {
        dataRoomId: null,
        folderId: '10000000-0000-4000-8000-000000000001',
        fileId: null,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) as Date },
    });
    const createArgument = publicCreate.mock.calls[0]?.[0] as {
      data: { tokenHash: string };
    };
    expect(createArgument.data.tokenHash).toHaveLength(64);
    expect(createArgument.data.tokenHash).not.toBe(result.token);
  });

  it('creates a grant for a registered normalized email', async () => {
    requireRegisteredRecipient.mockResolvedValue({ id: 'recipient-1' });
    grantFindFirst.mockResolvedValue(null);
    grantCreate.mockResolvedValue({ id: 'grant-1' });

    await service.createGrant('owner-1', {
      targetType: 'file',
      targetId: '10000000-0000-4000-8000-000000000002',
      email: '  Guest@Example.COM ',
    });

    expect(grantCreate).toHaveBeenCalledWith({
      data: {
        dataRoomId: null,
        folderId: null,
        fileId: '10000000-0000-4000-8000-000000000002',
        recipientEmail: 'guest@example.com',
        recipientUserId: 'recipient-1',
      },
    });
  });

  it('rejects a grant for an unregistered email', async () => {
    requireRegisteredRecipient.mockRejectedValue(
      new UnprocessableEntityException(
        'The recipient must have an existing account.',
      ),
    );

    await expect(
      service.createGrant('owner-1', {
        targetType: 'file',
        targetId: '10000000-0000-4000-8000-000000000002',
        email: 'guest@example.com',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(grantCreate).not.toHaveBeenCalled();
  });

  it('rejects an invalid, expired, or revoked public token', async () => {
    publicFindFirst.mockResolvedValue(null);

    await expect(service.getPublicRoot('invalid-token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
