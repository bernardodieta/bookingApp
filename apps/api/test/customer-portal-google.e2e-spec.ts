import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common/interfaces';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

function loadTestEnvironment() {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(__dirname, '../../.env'),
    resolve(__dirname, '../../../.env')
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath });
      break;
    }
  }

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:55432/apoint';
  }
}

loadTestEnvironment();

const prisma = new PrismaClient();

async function resetDatabase() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.waitlistEntry.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.availabilityException.deleteMany(),
    prisma.availabilityRule.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.staff.deleteMany(),
    prisma.service.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany()
  ]);
}

async function bootstrapApp() {
  process.env.PUBLIC_RATE_LIMIT_MAX = '200';
  process.env.PUBLIC_RATE_LIMIT_WINDOW_MS = '60000';
  process.env.PUBLIC_GOOGLE_LOGIN_RATE_LIMIT_MAX = '1';
  process.env.PUBLIC_GOOGLE_LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
  process.env.GOOGLE_CLIENT_ID = 'expected-google-client-id';

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  await app.init();
  return app;
}

async function registerTenantAndResolveSlug(app: INestApplication, tag: string) {
  const registerResponse = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      tenantName: `Tenant ${tag}`,
      email: `owner.${tag}@example.com`,
      password: 'Password123'
    })
    .expect(201);

  const tenant = await prisma.tenant.findUnique({
    where: { id: registerResponse.body.user.tenantId },
    select: { slug: true }
  });

  expect(tenant?.slug).toBeTruthy();
  return tenant!.slug;
}

describe('Customer portal Google auth hardening (e2e)', () => {
  let app: INestApplication;
  let verifyIdTokenSpy: jest.SpyInstance;

  beforeAll(() => {
    verifyIdTokenSpy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(async () => {
      throw new Error('Wrong recipient, payload audience does not match');
    });
  });

  beforeEach(async () => {
    await resetDatabase();
    app = await bootstrapApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    verifyIdTokenSpy.mockRestore();
  });

  it('rechaza login Google cuando la audiencia del token no coincide', async () => {
    const slug = await registerTenantAndResolveSlug(app, 'googleaudience');

    const response = await request(app.getHttpServer())
      .post(`/public/${slug}/customer-portal/google`)
      .send({ idToken: 'mock-token-invalid-audience' })
      .expect(401);

    expect(String(response.body.message)).toContain('No se pudo validar token de Google');
  });

  it('aplica rate limit específico al endpoint de Google login', async () => {
    const slug = await registerTenantAndResolveSlug(app, 'googleratelimit');

    await request(app.getHttpServer())
      .post(`/public/${slug}/customer-portal/google`)
      .send({ idToken: 'mock-token-invalid-audience' })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/public/${slug}/customer-portal/google`)
      .send({ idToken: 'mock-token-invalid-audience' })
      .expect(429);
  });
});
