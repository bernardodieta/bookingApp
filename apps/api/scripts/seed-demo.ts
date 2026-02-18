import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';
import { BookingStatus, PrismaClient, UserRole } from '@prisma/client';

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

function hashPassword(password: string) {
  return createHash('sha256').update(password).digest('hex');
}

function startOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

function setUtcTime(base: Date, hours: number, minutes = 0) {
  const value = new Date(base);
  value.setUTCHours(hours, minutes, 0, 0);
  return value;
}

async function ensureTenantSlug(prisma: PrismaClient, requestedSlug: string) {
  let attempt = 0;
  while (attempt < 100) {
    const candidate = attempt === 0 ? requestedSlug : `${requestedSlug}-${attempt}`;
    const exists = await prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) {
      return candidate;
    }
    attempt += 1;
  }

  throw new Error('No se pudo generar slug único para tenant demo.');
}

async function run() {
  loadEnvironment();

  const prisma = new PrismaClient();
  const demoEmail = process.env.DEMO_OWNER_EMAIL ?? 'owner@demo.com';
  const demoPassword = process.env.DEMO_OWNER_PASSWORD ?? 'Password123';
  const demoTenantName = process.env.DEMO_TENANT_NAME ?? 'Demo';
  const demoTenantSlug = (process.env.DEMO_TENANT_SLUG ?? 'demo').trim().toLowerCase();

  try {
    const passwordHash = hashPassword(demoPassword);

    let owner = await prisma.user.findUnique({
      where: { email: demoEmail.toLowerCase() },
      include: { tenant: true }
    });

    if (!owner) {
      const slug = await ensureTenantSlug(prisma, demoTenantSlug || 'demo');

      const tenant = await prisma.tenant.create({
        data: {
          name: demoTenantName,
          slug,
          bookingBufferMinutes: 10,
          maxBookingsPerDay: 20,
          maxBookingsPerWeek: 80,
          cancellationNoticeHours: 2,
          rescheduleNoticeHours: 2
        }
      });

      owner = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: demoEmail.toLowerCase(),
          passwordHash,
          role: UserRole.owner
        },
        include: { tenant: true }
      });
    } else {
      owner = await prisma.user.update({
        where: { id: owner.id },
        data: { passwordHash },
        include: { tenant: true }
      });
    }

    const tenantId = owner.tenantId;
    const today = startOfTodayUtc();

    let staff = await prisma.staff.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email: 'staff.demo@demo.com'
        }
      }
    });

    if (!staff) {
      staff = await prisma.staff.create({
        data: {
          tenantId,
          fullName: 'Staff Demo',
          email: 'staff.demo@demo.com',
          active: true
        }
      });
    }

    let service = await prisma.service.findFirst({
      where: {
        tenantId,
        name: 'Consulta General'
      }
    });

    if (!service) {
      service = await prisma.service.create({
        data: {
          tenantId,
          name: 'Consulta General',
          durationMinutes: 30,
          price: 250,
          active: true
        }
      });
    }

    const dayOfWeek = today.getUTCDay();
    const existingRule = await prisma.availabilityRule.findFirst({
      where: {
        tenantId,
        staffId: staff.id,
        dayOfWeek,
        startTime: '08:00',
        endTime: '18:00',
        isActive: true
      }
    });

    if (!existingRule) {
      await prisma.availabilityRule.create({
        data: {
          tenantId,
          staffId: staff.id,
          dayOfWeek,
          startTime: '08:00',
          endTime: '18:00',
          isActive: true
        }
      });
    }

    const bookingSeeds = [
      {
        customerName: 'Ana Cliente',
        customerEmail: 'ana.cliente@demo.com',
        startAt: setUtcTime(today, 9, 0),
        status: BookingStatus.confirmed
      },
      {
        customerName: 'Luis Cliente',
        customerEmail: 'luis.cliente@demo.com',
        startAt: setUtcTime(today, 11, 0),
        status: BookingStatus.rescheduled
      },
      {
        customerName: 'María Cliente',
        customerEmail: 'maria.cliente@demo.com',
        startAt: setUtcTime(today, 15, 0),
        status: BookingStatus.pending
      }
    ];

    for (const item of bookingSeeds) {
      const customer = await prisma.customer.upsert({
        where: {
          tenantId_email: {
            tenantId,
            email: item.customerEmail
          }
        },
        update: {
          fullName: item.customerName
        },
        create: {
          tenantId,
          fullName: item.customerName,
          email: item.customerEmail
        }
      });

      const endAt = new Date(item.startAt.getTime() + service.durationMinutes * 60_000);
      const existingBooking = await prisma.booking.findFirst({
        where: {
          tenantId,
          serviceId: service.id,
          staffId: staff.id,
          customerEmail: item.customerEmail,
          startAt: item.startAt
        }
      });

      if (!existingBooking) {
        await prisma.booking.create({
          data: {
            tenantId,
            customerId: customer.id,
            serviceId: service.id,
            staffId: staff.id,
            customerName: item.customerName,
            customerEmail: item.customerEmail,
            startAt: item.startAt,
            endAt,
            status: item.status
          }
        });
      }
    }

    console.log('✅ Seed demo listo');
    console.log(`Tenant: ${owner.tenant.name} (slug: ${owner.tenant.slug})`);
    console.log(`Email: ${demoEmail.toLowerCase()}`);
    console.log(`Password: ${demoPassword}`);
    console.log('API URL: http://localhost:3001');
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error('❌ Error en seed demo:', error);
  process.exit(1);
});