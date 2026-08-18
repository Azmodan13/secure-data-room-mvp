import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports that the service is healthy', () => {
      const result = appController.getHealth();

      expect(result.data.service).toBe('secure-data-room-api');
      expect(result.data.status).toBe('ok');
      expect(typeof result.data.timestamp).toBe('string');
    });
  });
});
