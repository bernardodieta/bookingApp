import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common/interfaces';
import { Test } from '@nestjs/testing';
import { BookingStatus, PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

type AuthContext = {
  token: string;
  tenantId: string;
};

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

function authHeader(token: string) {
  return `Bearer ${token}`;
}

function nextWeekdayUtc(targetDay: number, hour = 10, minute = 0) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0));
  const currentDay = base.getUTCDay();
  let delta = targetDay - currentDay;
  if (delta < 0) {
    delta += 7;
  }
  if (delta === 0 && base <= now) {
    delta = 7;
  }
  base.setUTCDate(base.getUTCDate() + delta);
  return base;
}

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

async function bootstrapApp(rateLimitMax: number, rateLimitWindowMs: number) {
  process.env.PUBLIC_RATE_LIMIT_MAX = String(rateLimitMax);
  process.env.PUBLIC_RATE_LIMIT_WINDOW_MS = String(rateLimitWindowMs);

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

async function registerAndSeed(app: INestApplication, tag: string) {
  const registerResponse = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      tenantName: `Tenant ${tag}`,
      email: `owner.${tag}@example.com`,
      password: 'Password123'
    })
    .expect(201);

  const auth: AuthContext = {
    token: registerResponse.body.accessToken,
    tenantId: registerResponse.body.user.tenantId
  };

  const serviceResponse = await request(app.getHttpServer())
    .post('/services')
    .set('Authorization', authHeader(auth.token))
    .send({
      name: `Consulta ${tag}`,
      durationMinutes: 30,
      price: 100
    })
    .expect(201);

  const staffResponse = await request(app.getHttpServer())
    .post('/staff')
    .set('Authorization', authHeader(auth.token))
    .send({
      fullName: `Profesional ${tag}`,
      email: `staff.${tag}@example.com`
    })
    .expect(201);

  const startAt = nextWeekdayUtc(1, 10, 0);
  const dayOfWeek = startAt.getUTCDay();

  await request(app.getHttpServer())
    .post('/availability/rules')
    .set('Authorization', authHeader(auth.token))
    .send({
      dayOfWeek,
      startTime: '08:00',
      endTime: '20:00',
      staffId: staffResponse.body.id
    })
    .expect(201);

  return {
    auth,
    service: serviceResponse.body,
    staff: staffResponse.body,
    startAt
  };
}

describe('Critical MVP rules (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapApp(200, 60_000);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registra BOOKING_CREATED en auditoría al crear una reserva', async () => {
    const seed = await registerAndSeed(app, 'audit');

    const bookingResponse = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Uno',
        customerEmail: 'cliente.uno@example.com'
      })
      .expect(201);

    const audit = await prisma.auditLog.findFirst({
      where: {
        tenantId: seed.auth.tenantId,
        action: 'BOOKING_CREATED',
        entity: 'booking',
        entityId: bookingResponse.body.id
      }
    });

    expect(audit).toBeTruthy();
  });

  it('bloquea reservas superpuestas para el mismo empleado', async () => {
    const seed = await registerAndSeed(app, 'collision');

    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Base',
        customerEmail: 'cliente.base@example.com'
      })
      .expect(201);

    const secondResponse = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Doble',
        customerEmail: 'cliente.doble@example.com'
      })
      .expect(400);

    expect(String(secondResponse.body.message)).toContain('ocupado');
  });

  it('hace cumplir el límite mensual del plan free (50 citas)', async () => {
    const seed = await registerAndSeed(app, 'planfree');

    const monthStart = new Date(Date.UTC(seed.startAt.getUTCFullYear(), seed.startAt.getUTCMonth(), 1, 8, 0, 0, 0));
    const bulkBookings = Array.from({ length: 50 }).map((_, index) => {
      const slotStart = new Date(monthStart.getTime() + index * 40 * 60_000);
      const slotEnd = new Date(slotStart.getTime() + 30 * 60_000);

      return {
        tenantId: seed.auth.tenantId,
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        customerName: `Cliente ${index + 1}`,
        customerEmail: `cliente${index + 1}@example.com`,
        startAt: slotStart,
        endAt: slotEnd,
        status: BookingStatus.confirmed
      };
    });

    await prisma.booking.createMany({ data: bulkBookings });

    const blockedResponse = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Excedido',
        customerEmail: 'cliente.excedido@example.com'
      })
      .expect(400);

    expect(String(blockedResponse.body.message)).toContain('máximo mensual');
  });

  it('permite actualizar y eliminar reglas y excepciones de disponibilidad del tenant autenticado', async () => {
    const seed = await registerAndSeed(app, 'availabilitycrud');

    const rulesResponse = await request(app.getHttpServer())
      .get('/availability/rules')
      .set('Authorization', authHeader(seed.auth.token))
      .expect(200);

    expect(Array.isArray(rulesResponse.body)).toBe(true);
    expect(rulesResponse.body.length).toBeGreaterThanOrEqual(1);
    const ruleId = rulesResponse.body[0].id as string;

    const updatedRule = await request(app.getHttpServer())
      .patch(`/availability/rules/${ruleId}`)
      .set('Authorization', authHeader(seed.auth.token))
      .send({ isActive: false })
      .expect(200);

    expect(updatedRule.body.isActive).toBe(false);

    await request(app.getHttpServer())
      .delete(`/availability/rules/${ruleId}`)
      .set('Authorization', authHeader(seed.auth.token))
      .expect(200);

    const createdException = await request(app.getHttpServer())
      .post('/availability/exceptions')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        date: seed.startAt.toISOString(),
        startTime: '11:00',
        endTime: '12:00',
        staffId: seed.staff.id,
        isUnavailable: true,
        note: 'Bloqueo inicial'
      })
      .expect(201);

    const exceptionId = createdException.body.id as string;

    const updatedException = await request(app.getHttpServer())
      .patch(`/availability/exceptions/${exceptionId}`)
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        isUnavailable: false,
        note: 'Bloqueo removido'
      })
      .expect(200);

    expect(updatedException.body.isUnavailable).toBe(false);
    expect(updatedException.body.note).toBe('Bloqueo removido');

    await request(app.getHttpServer())
      .delete(`/availability/exceptions/${exceptionId}`)
      .set('Authorization', authHeader(seed.auth.token))
      .expect(200);

    const finalExceptions = await request(app.getHttpServer())
      .get('/availability/exceptions')
      .set('Authorization', authHeader(seed.auth.token))
      .expect(200);

    expect(finalExceptions.body).toHaveLength(0);
  });

  it('envía recordatorios de booking en ventana configurada y evita duplicados por auditoría', async () => {
    const seed = await registerAndSeed(app, 'bookingreminders');

    await request(app.getHttpServer())
      .patch('/tenant/settings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({ reminderHoursBefore: 24 })
      .expect(200);

    const reminderStartAt = new Date(Date.now() + 24 * 60 * 60_000 + 5 * 60_000);
    const reminderEndAt = new Date(reminderStartAt.getTime() + 30 * 60_000);

    const booking = await prisma.booking.create({
      data: {
        tenantId: seed.auth.tenantId,
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        customerName: 'Cliente Reminder',
        customerEmail: 'cliente.reminder@example.com',
        startAt: reminderStartAt,
        endAt: reminderEndAt,
        status: BookingStatus.confirmed
      }
    });

    const firstRun = await request(app.getHttpServer())
      .post('/bookings/reminders/run')
      .set('Authorization', authHeader(seed.auth.token))
      .expect(201);

    expect(firstRun.body.sent).toBe(1);
    expect(firstRun.body.processed).toBeGreaterThanOrEqual(1);

    const reminderAudit = await prisma.auditLog.findFirst({
      where: {
        tenantId: seed.auth.tenantId,
        action: 'BOOKING_REMINDER_SENT',
        entity: 'booking',
        entityId: booking.id
      }
    });

    expect(reminderAudit).toBeTruthy();

    const secondRun = await request(app.getHttpServer())
      .post('/bookings/reminders/run')
      .set('Authorization', authHeader(seed.auth.token))
      .expect(201);

    expect(secondRun.body.sent).toBe(0);
    expect(secondRun.body.skippedAlreadySent).toBeGreaterThanOrEqual(1);
  });

  it('registra depósito + pago total y refleja ingresos en reportes', async () => {
    const seed = await registerAndSeed(app, 'paymentsreports');

    const bookingResponse = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Pagos',
        customerEmail: 'cliente.pagos@example.com'
      })
      .expect(201);

    const depositResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        bookingId: bookingResponse.body.id,
        mode: 'deposit',
        amount: 40,
        method: 'cash'
      })
      .expect(201);

    expect(depositResponse.body.summary.outstanding).toBe(60);

    const fullResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        bookingId: bookingResponse.body.id,
        mode: 'full',
        method: 'card'
      })
      .expect(201);

    expect(fullResponse.body.summary.outstanding).toBe(0);

    const paymentList = await request(app.getHttpServer())
      .get(`/payments?bookingId=${bookingResponse.body.id}`)
      .set('Authorization', authHeader(seed.auth.token))
      .expect(200);

    expect(paymentList.body.length).toBe(2);

    const saleNote = await request(app.getHttpServer())
      .get(`/payments/${paymentList.body[0].id}/sale-note`)
      .set('Authorization', authHeader(seed.auth.token))
      .expect(200);

    expect(String(saleNote.body.folio)).toContain('NV-');

    const reportsResponse = await request(app.getHttpServer())
      .get(`/dashboard/reports?range=week&date=${seed.startAt.toISOString().slice(0, 10)}`)
      .set('Authorization', authHeader(seed.auth.token))
      .expect(200);

    expect(reportsResponse.body.totals.netRevenue).toBe(100);
    expect(Array.isArray(reportsResponse.body.topServices)).toBe(true);
    expect(Array.isArray(reportsResponse.body.topCustomers)).toBe(true);
    expect(Array.isArray(reportsResponse.body.peakHours)).toBe(true);
  });

  it('aplica refundPolicy=full al cancelar reserva pagada y crea payment refund', async () => {
    const seed = await registerAndSeed(app, 'refundpolicy');

    await request(app.getHttpServer())
      .patch('/tenant/settings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({ refundPolicy: 'full' })
      .expect(200);

    const bookingResponse = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Refund',
        customerEmail: 'cliente.refund@example.com'
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        bookingId: bookingResponse.body.id,
        mode: 'full',
        method: 'card'
      })
      .expect(201);

    const cancelResponse = await request(app.getHttpServer())
      .patch(`/bookings/${bookingResponse.body.id}/cancel`)
      .set('Authorization', authHeader(seed.auth.token))
      .send({ reason: 'Cancelación con política full' })
      .expect(200);

    expect(cancelResponse.body.refundResolution?.action).toBe('refund');
    expect(cancelResponse.body.refundResolution?.amount).toBe(100);

    const refundPayment = await prisma.payment.findFirst({
      where: {
        tenantId: seed.auth.tenantId,
        bookingId: bookingResponse.body.id,
        kind: 'refund'
      }
    });

    expect(refundPayment).toBeTruthy();
    expect(Number(refundPayment?.amount ?? 0)).toBe(100);
  });
});

describe('Public/Auth rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapApp(2, 60_000);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 429 al exceder el límite en ruta pública', async () => {
    const first = await request(app.getHttpServer()).get('/public/no-tenant');
    const second = await request(app.getHttpServer()).get('/public/no-tenant');
    const third = await request(app.getHttpServer()).get('/public/no-tenant');

    expect(first.status).not.toBe(429);
    expect(second.status).not.toBe(429);
    expect(third.status).toBe(429);
  });
});

describe('Public booking flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapApp(200, 60_000);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('oculta en slots públicos un horario ya ocupado y auto-agrega a waitlist al intentar reservarlo', async () => {
    const seed = await registerAndSeed(app, 'publicslots');

    const tenant = await prisma.tenant.findUnique({
      where: { id: seed.auth.tenantId },
      select: { slug: true }
    });

    expect(tenant).toBeTruthy();

    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Privado',
        customerEmail: 'cliente.privado@example.com'
      })
      .expect(201);

    const slotsResponse = await request(app.getHttpServer())
      .get(
        `/public/${tenant?.slug}/slots?serviceId=${seed.service.id}&staffId=${seed.staff.id}&date=${seed.startAt
          .toISOString()
          .slice(0, 10)}`
      )
      .expect(200);

    const slotStartTimes = (slotsResponse.body.slots as Array<{ startAt: string }>).map((slot) => slot.startAt);
    expect(slotStartTimes).not.toContain(seed.startAt.toISOString());

    const occupiedBookingResponse = await request(app.getHttpServer())
      .post(`/public/${tenant?.slug}/bookings`)
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Publico',
        customerEmail: 'cliente.publico@example.com'
      })
      .expect(201);

    expect(occupiedBookingResponse.body.waitlisted).toBe(true);
    expect(occupiedBookingResponse.body.waitlistEntry.status).toBe('waiting');
  });

  it('marca como notified al siguiente en waitlist cuando se cancela la cita del slot', async () => {
    const seed = await registerAndSeed(app, 'waitlistnotify');

    const tenant = await prisma.tenant.findUnique({
      where: { id: seed.auth.tenantId },
      select: { slug: true }
    });

    expect(tenant).toBeTruthy();

    const bookingResponse = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Original',
        customerEmail: 'cliente.original@example.com'
      })
      .expect(201);

    const waitlistResponse = await request(app.getHttpServer())
      .post(`/public/${tenant?.slug}/waitlist`)
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        preferredStartAt: seed.startAt.toISOString(),
        customerName: 'Cliente En Espera',
        customerEmail: 'cliente.espera@example.com'
      })
      .expect(201);

    expect(waitlistResponse.body.status).toBe('waiting');

    await request(app.getHttpServer())
      .patch(`/bookings/${bookingResponse.body.id}/cancel`)
      .set('Authorization', authHeader(seed.auth.token))
      .send({ reason: 'Cambio de planes' })
      .expect(200);

    const updatedWaitlist = await prisma.waitlistEntry.findUnique({ where: { id: waitlistResponse.body.id } });
    expect(updatedWaitlist?.status).toBe('notified');
    expect(updatedWaitlist?.notifiedAt).toBeTruthy();
  });

  it('expone fields configurados en formulario público y persiste customFields al reservar', async () => {
    const seed = await registerAndSeed(app, 'publicform');

    const tenant = await prisma.tenant.findUnique({
      where: { id: seed.auth.tenantId },
      select: { slug: true }
    });

    expect(tenant).toBeTruthy();

    const configuredFields = [
      {
        key: 'phone',
        label: 'Teléfono',
        type: 'text',
        required: true
      },
      {
        key: 'dni',
        label: 'DNI',
        type: 'text',
        required: false
      }
    ];

    await request(app.getHttpServer())
      .patch('/tenant/settings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({ bookingFormFields: configuredFields })
      .expect(200);

    const publicFormResponse = await request(app.getHttpServer())
      .get(`/public/${tenant?.slug}/form`)
      .expect(200);

    expect(publicFormResponse.body.fields).toEqual(configuredFields);

    const customFields = {
      phone: '+52 555 123 4567',
      dni: 'ABC123456'
    };

    const bookingResponse = await request(app.getHttpServer())
      .post(`/public/${tenant?.slug}/bookings`)
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Formulario Público',
        customerEmail: 'cliente.form.publico@example.com',
        customFields
      })
      .expect(201);

    expect(bookingResponse.body.waitlisted).not.toBe(true);

    const persistedBooking = await prisma.booking.findUnique({
      where: { id: bookingResponse.body.id },
      select: {
        customFields: true,
        customerEmail: true,
        tenantId: true
      }
    });

    expect(persistedBooking).toBeTruthy();
    expect(persistedBooking?.customFields).toEqual(customFields);

    const persistedCustomer = await prisma.customer.findUnique({
      where: {
        tenantId_email: {
          tenantId: seed.auth.tenantId,
          email: 'cliente.form.publico@example.com'
        }
      },
      select: {
        phone: true,
        metadata: true
      }
    });

    expect(persistedCustomer).toBeTruthy();
    expect(persistedCustomer?.phone).toBe(customFields.phone);
    expect(persistedCustomer?.metadata).toEqual(customFields);
  });

  it('rechaza reserva pública si falta un customField requerido por tenant settings', async () => {
    const seed = await registerAndSeed(app, 'publicrequired');

    const tenant = await prisma.tenant.findUnique({
      where: { id: seed.auth.tenantId },
      select: { slug: true }
    });

    expect(tenant).toBeTruthy();

    await request(app.getHttpServer())
      .patch('/tenant/settings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        bookingFormFields: [
          {
            key: 'phone',
            label: 'Teléfono',
            type: 'text',
            required: true
          }
        ]
      })
      .expect(200);

    const missingRequiredResponse = await request(app.getHttpServer())
      .post(`/public/${tenant?.slug}/bookings`)
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Sin Teléfono',
        customerEmail: 'cliente.sin.telefono@example.com',
        customFields: {}
      })
      .expect(400);

    expect(missingRequiredResponse.body.message).toBe('Completa el campo requerido: Teléfono.');
  });
});

describe('Audit logs endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapApp(200, 60_000);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requiere autenticación', async () => {
    await request(app.getHttpServer()).get('/audit/logs').expect(401);
  });

  it('devuelve logs filtrados por tenant, acción y actorUserId', async () => {
    const seedA = await registerAndSeed(app, 'auditlista');
    const seedB = await registerAndSeed(app, 'auditlistb');

    const bookingResponseA = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(seedA.auth.token))
      .send({
        serviceId: seedA.service.id,
        staffId: seedA.staff.id,
        startAt: seedA.startAt.toISOString(),
        customerName: 'Cliente A',
        customerEmail: 'cliente.a@example.com'
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/bookings/${bookingResponseA.body.id}/cancel`)
      .set('Authorization', authHeader(seedA.auth.token))
      .send({ reason: 'Cancelación para auditoría' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/tenant/settings')
      .set('Authorization', authHeader(seedA.auth.token))
      .send({ bookingBufferMinutes: 10 })
      .expect(200);

    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(seedB.auth.token))
      .send({
        serviceId: seedB.service.id,
        staffId: seedB.staff.id,
        startAt: seedB.startAt.toISOString(),
        customerName: 'Cliente B',
        customerEmail: 'cliente.b@example.com'
      })
      .expect(201);

    const userA = await prisma.user.findFirst({
      where: { tenantId: seedA.auth.tenantId, email: 'owner.auditlista@example.com' },
      select: { id: true }
    });

    expect(userA).toBeTruthy();

    const from = encodeURIComponent(new Date(Date.now() - 60 * 60 * 1000).toISOString());

    const actorFiltered = await request(app.getHttpServer())
      .get(`/audit/logs?action=BOOKING_CANCELLED&actorUserId=${userA?.id}&from=${from}&limit=10`)
      .set('Authorization', authHeader(seedA.auth.token))
      .expect(200);

    expect(Array.isArray(actorFiltered.body.items)).toBe(true);
    expect(actorFiltered.body.items.length).toBe(1);
    expect(actorFiltered.body.items[0].action).toBe('BOOKING_CANCELLED');
    expect(actorFiltered.body.items[0].tenantId).toBe(seedA.auth.tenantId);
    expect(actorFiltered.body.items[0].actorUserId).toBe(userA?.id);
    expect(actorFiltered.body.nextCursor).toBeNull();

    const tenantBLogsVisibleToA = actorFiltered.body.items.some(
      (entry: { tenantId: string }) => entry.tenantId === seedB.auth.tenantId
    );
    expect(tenantBLogsVisibleToA).toBe(false);
  });

  it('pagina con cursor y retorna nextCursor cuando hay más resultados', async () => {
    const seed = await registerAndSeed(app, 'auditcursor');

    const bookingResponse = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Cursor',
        customerEmail: 'cliente.cursor@example.com'
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/bookings/${bookingResponse.body.id}/cancel`)
      .set('Authorization', authHeader(seed.auth.token))
      .send({ reason: 'Cursor test' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/tenant/settings')
      .set('Authorization', authHeader(seed.auth.token))
      .send({ bookingBufferMinutes: 15 })
      .expect(200);

    const firstPage = await request(app.getHttpServer())
      .get('/audit/logs?limit=2')
      .set('Authorization', authHeader(seed.auth.token))
      .expect(200);

    expect(firstPage.body.items.length).toBe(2);
    expect(typeof firstPage.body.nextCursor).toBe('string');

    const firstPageIds = new Set((firstPage.body.items as Array<{ id: string }>).map((entry) => entry.id));

    const secondPage = await request(app.getHttpServer())
      .get(`/audit/logs?limit=2&cursor=${firstPage.body.nextCursor}`)
      .set('Authorization', authHeader(seed.auth.token))
      .expect(200);

    expect(secondPage.body.items.length).toBeGreaterThanOrEqual(1);
    expect(secondPage.body.items.every((entry: { id: string }) => !firstPageIds.has(entry.id))).toBe(true);
  });
});

describe('MVP mandatory QA flows (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapApp(200, 60_000);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('smoke e2e: registro negocio -> crear servicio/staff -> reservar públicamente', async () => {
    const seed = await registerAndSeed(app, 'smokeflow');

    const tenant = await prisma.tenant.findUnique({
      where: { id: seed.auth.tenantId },
      select: { slug: true }
    });

    expect(tenant).toBeTruthy();

    const slotsResponse = await request(app.getHttpServer())
      .get(
        `/public/${tenant?.slug}/slots?serviceId=${seed.service.id}&staffId=${seed.staff.id}&date=${seed.startAt
          .toISOString()
          .slice(0, 10)}`
      )
      .expect(200);

    const slotStartTimes = (slotsResponse.body.slots as Array<{ startAt: string }>).map((slot) => slot.startAt);
    expect(slotStartTimes).toContain(seed.startAt.toISOString());

    const publicBooking = await request(app.getHttpServer())
      .post(`/public/${tenant?.slug}/bookings`)
      .send({
        serviceId: seed.service.id,
        staffId: seed.staff.id,
        startAt: seed.startAt.toISOString(),
        customerName: 'Cliente Smoke',
        customerEmail: 'cliente.smoke@example.com'
      })
      .expect(201);

    expect(publicBooking.body.waitlisted).not.toBe(true);
    expect(publicBooking.body.status).toBe('confirmed');
    expect(publicBooking.body.serviceId).toBe(seed.service.id);
    expect(publicBooking.body.staffId).toBe(seed.staff.id);
  });

  it('aislamiento multi-tenant: no permite acceso cruzado de datos', async () => {
    const tenantA = await registerAndSeed(app, 'tenanta');
    const tenantB = await registerAndSeed(app, 'tenantb');

    const bookingA = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', authHeader(tenantA.auth.token))
      .send({
        serviceId: tenantA.service.id,
        staffId: tenantA.staff.id,
        startAt: tenantA.startAt.toISOString(),
        customerName: 'Cliente A',
        customerEmail: 'cliente.a.tenant@example.com'
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/bookings/${bookingA.body.id}/cancel`)
      .set('Authorization', authHeader(tenantB.auth.token))
      .send({ reason: 'No debería poder' })
      .expect(404);

    const listB = await request(app.getHttpServer())
      .get('/bookings')
      .set('Authorization', authHeader(tenantB.auth.token))
      .expect(200);

    expect(Array.isArray(listB.body)).toBe(true);
    expect(listB.body.some((entry: { id: string }) => entry.id === bookingA.body.id)).toBe(false);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});