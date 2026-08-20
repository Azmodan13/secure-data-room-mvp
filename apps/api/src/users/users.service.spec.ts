import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('normalizes email when creating the local identity', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'user-1' });
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
    } as unknown as PrismaService;
    const service = new UsersService(prisma);

    await service.resolve({
      authUserId: '10000000-0000-4000-8000-000000000001',
      email: ' Guest@Example.COM ',
      displayName: 'Guest',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        authUserId: '10000000-0000-4000-8000-000000000001',
        email: 'guest@example.com',
        displayName: 'Guest',
      },
    });
  });
});
