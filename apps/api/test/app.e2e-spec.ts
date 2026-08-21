import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SupabaseJwtService } from './../src/auth/supabase-jwt.service';
import { PrismaService } from './../src/prisma/prisma.service';
import { StorageService } from './../src/storage/storage.service';

type HealthResponse = {
  data: {
    service: string;
    status: string;
  };
};

type ErrorResponse = {
  message: string;
};

describe('AppController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  const jwtService = {
    verify: jest.fn(),
  };
  const storageService = {
    removeObjects: jest.fn(),
  };
  const prismaService = {};

  beforeEach(async () => {
    jwtService.verify.mockReset();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseJwtService)
      .useValue(jwtService)
      .overrideProvider(StorageService)
      .useValue(storageService)
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('/api/v1/health (GET)', () => {
    return request(app!.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        const health = body as HealthResponse;

        expect(health.data.service).toBe('secure-data-room-api');
        expect(health.data.status).toBe('ok');
      });
  });

  it('/api/v1/me (GET) rejects a missing token', () => {
    return request(app!.getHttpServer())
      .get('/api/v1/me')
      .expect(401)
      .expect(({ body }) => {
        const error = body as ErrorResponse;

        expect(error.message).toBe('Bearer access token is required.');
      });
  });

  it('/api/v1/me (GET) rejects a malformed token', () => {
    jwtService.verify.mockRejectedValueOnce(
      new UnauthorizedException('Invalid or expired access token.'),
    );

    return request(app!.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', 'Bearer not-a-valid-jwt')
      .expect(401)
      .expect(({ body }) => {
        const error = body as ErrorResponse;

        expect(error.message).toBe('Invalid or expired access token.');
      });
  });

  it.each([
    ['GET', '/api/v1/data-rooms'],
    ['POST', '/api/v1/data-rooms'],
    ['GET', '/api/v1/shares/received'],
    [
      'POST',
      '/api/v1/data-rooms/10000000-0000-4000-8000-000000000001/upload-intents',
    ],
  ])('%s %s rejects a missing token', (method, path) => {
    const agent = request(app!.getHttpServer());
    const call = method === 'GET' ? agent.get(path) : agent.post(path);

    return call.expect(401).expect(({ body }) => {
      const error = body as ErrorResponse;

      expect(error.message).toBe('Bearer access token is required.');
    });
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });
});
