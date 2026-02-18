import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

function loadEnvironment() {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(__dirname, '../../.env'),
    resolve(__dirname, '../../../.env')
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return;
    }
  }

  dotenv.config();
}

loadEnvironment();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.enableCors();
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

bootstrap();
