import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3001);
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: webOrigin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  await app.listen(port);
}

void bootstrap();
