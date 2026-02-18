import { BadRequestException } from '@nestjs/common';
import { BookingStatus, Plan } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { BookingsService } from './bookings.service';

function createBookingsService() {
  const prisma = {
    service: { findFirst: jest.fn() },
    staff: { findFirst: jest.fn() },
    tenant: { findUnique: jest.fn() },
    customer: { upsert: jest.fn() },
    availabilityRule: { findMany: jest.fn() },
    availabilityException: { findMany: jest.fn() },
    booking: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn()
    },
    waitlistEntry: {
      findFirst: jest.fn(),
      update: jest.fn()
    }
  };

  const notificationsService = {
    sendBookingCreatedEmails: jest.fn(),
    sendWaitlistSlotAvailableEmail: jest.fn()
  };

  const auditService = {
    log: jest.fn()
  };

  const service = new BookingsService(prisma as never, notificationsService as never, auditService as never);
  return { service, prisma, notificationsService, auditService };
}

function defaultTenantSettings(plan: Plan = 'free') {
  return {
    name: 'Demo Tenant',
    slug: 'demo',
    plan,
    bookingBufferMinutes: 0,
    maxBookingsPerDay: null,
    maxBookingsPerWeek: null,
    cancellationNoticeHours: 0,
    rescheduleNoticeHours: 0,
    refundPolicy: 'none'
  };
}

describe('BookingsService (unit)', () => {
  it('rechaza creación cuando el horario del staff ya está ocupado', async () => {
    const { service, prisma } = createBookingsService();

    prisma.service.findFirst.mockResolvedValue({ id: 'service-1', name: 'Consulta', durationMinutes: 30, active: true });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', fullName: 'Staff Demo', active: true });
    prisma.tenant.findUnique.mockResolvedValue(defaultTenantSettings('free'));
    prisma.booking.count.mockResolvedValue(0);
    prisma.customer.upsert.mockResolvedValue({ id: 'customer-1' });
    prisma.availabilityRule.findMany.mockResolvedValue([{ startTime: '08:00', endTime: '18:00' }]);
    prisma.availabilityException.findMany.mockResolvedValue([]);
    prisma.booking.findFirst.mockResolvedValue({ id: 'booking-existing' });

    const payload = {
      serviceId: 'service-1',
      staffId: 'staff-1',
      startAt: '2030-01-10T10:00:00.000Z',
      customerName: 'Cliente Uno',
      customerEmail: 'cliente.uno@example.com'
    };

    await expect(service.createForTenant('tenant-1', payload, false, 'user-1')).rejects.toThrow('ocupado');
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('aplica política de aviso mínimo para cancelación', async () => {
    const { service, prisma } = createBookingsService();

    const bookingStart = new Date(Date.now() + 30 * 60 * 1000);
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      tenantId: 'tenant-1',
      serviceId: 'service-1',
      staffId: 'staff-1',
      status: BookingStatus.confirmed,
      startAt: bookingStart,
      endAt: new Date(bookingStart.getTime() + 30 * 60 * 1000)
    });
    prisma.tenant.findUnique.mockResolvedValue({
      ...defaultTenantSettings('free'),
      cancellationNoticeHours: 2
    });

    const user: AuthUser = { sub: 'user-1', tenantId: 'tenant-1', email: 'owner@demo.com' };
    await expect(service.cancel(user, 'booking-1', { reason: 'Cambio de planes' })).rejects.toThrow('cancelar');
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('aplica política de aviso mínimo para reprogramación', async () => {
    const { service, prisma } = createBookingsService();

    const bookingStart = new Date(Date.now() + 20 * 60 * 1000);
    const bookingRecord = {
      id: 'booking-1',
      tenantId: 'tenant-1',
      serviceId: 'service-1',
      staffId: 'staff-1',
      status: BookingStatus.confirmed,
      startAt: bookingStart,
      endAt: new Date(bookingStart.getTime() + 30 * 60 * 1000)
    };

    prisma.booking.findFirst.mockResolvedValueOnce(bookingRecord).mockResolvedValueOnce({
      ...bookingRecord,
      service: { durationMinutes: 30 }
    });
    prisma.tenant.findUnique.mockResolvedValue({
      ...defaultTenantSettings('free'),
      rescheduleNoticeHours: 2
    });

    const user: AuthUser = { sub: 'user-1', tenantId: 'tenant-1', email: 'owner@demo.com' };
    await expect(
      service.reschedule(user, 'booking-1', {
        startAt: '2030-01-10T12:00:00.000Z'
      })
    ).rejects.toThrow('reprogramar');
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('rechaza creación al superar el máximo de reservas por día', async () => {
    const { service, prisma } = createBookingsService();

    prisma.service.findFirst.mockResolvedValue({ id: 'service-1', name: 'Consulta', durationMinutes: 30, active: true });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', fullName: 'Staff Demo', active: true });
    prisma.tenant.findUnique.mockResolvedValue({
      ...defaultTenantSettings('free'),
      maxBookingsPerDay: 1,
      maxBookingsPerWeek: null
    });
    prisma.booking.count.mockResolvedValueOnce(1);

    const payload = {
      serviceId: 'service-1',
      staffId: 'staff-1',
      startAt: '2030-01-10T10:00:00.000Z',
      customerName: 'Cliente Límite Día',
      customerEmail: 'cliente.dia@example.com'
    };

    await expect(service.createForTenant('tenant-1', payload, false, 'user-1')).rejects.toThrow('máximo de reservas por día');
    expect(prisma.customer.upsert).not.toHaveBeenCalled();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('rechaza creación al superar el máximo de reservas por semana', async () => {
    const { service, prisma } = createBookingsService();

    prisma.service.findFirst.mockResolvedValue({ id: 'service-1', name: 'Consulta', durationMinutes: 30, active: true });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', fullName: 'Staff Demo', active: true });
    prisma.tenant.findUnique.mockResolvedValue({
      ...defaultTenantSettings('free'),
      maxBookingsPerDay: null,
      maxBookingsPerWeek: 2
    });
    prisma.booking.count.mockResolvedValueOnce(2);

    const payload = {
      serviceId: 'service-1',
      staffId: 'staff-1',
      startAt: '2030-01-10T10:00:00.000Z',
      customerName: 'Cliente Límite Semana',
      customerEmail: 'cliente.semana@example.com'
    };

    await expect(service.createForTenant('tenant-1', payload, false, 'user-1')).rejects.toThrow('máximo de reservas por semana');
    expect(prisma.customer.upsert).not.toHaveBeenCalled();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('rechaza creación al superar el límite mensual del plan free', async () => {
    const { service, prisma } = createBookingsService();

    prisma.service.findFirst.mockResolvedValue({ id: 'service-1', name: 'Consulta', durationMinutes: 30, active: true });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', fullName: 'Staff Demo', active: true });
    prisma.tenant.findUnique.mockResolvedValue({
      ...defaultTenantSettings('free'),
      maxBookingsPerDay: null,
      maxBookingsPerWeek: null
    });
    prisma.booking.count.mockResolvedValueOnce(50);

    const payload = {
      serviceId: 'service-1',
      staffId: 'staff-1',
      startAt: '2030-01-10T10:00:00.000Z',
      customerName: 'Cliente Límite Mensual',
      customerEmail: 'cliente.mes@example.com'
    };

    await expect(service.createForTenant('tenant-1', payload, false, 'user-1')).rejects.toThrow('máximo mensual');
    expect(prisma.customer.upsert).not.toHaveBeenCalled();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('genera slots públicos según reglas activas del staff', async () => {
    const { service, prisma } = createBookingsService();

    const day = new Date(Date.UTC(2030, 0, 14, 0, 0, 0, 0));
    const date = day.toISOString().slice(0, 10);

    prisma.service.findFirst.mockResolvedValue({ id: 'service-1', durationMinutes: 30, active: true });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', active: true });
    prisma.tenant.findUnique.mockResolvedValue(defaultTenantSettings('free'));
    prisma.booking.count.mockResolvedValue(0);
    prisma.availabilityRule.findMany.mockResolvedValue([{ startTime: '09:00', endTime: '10:00' }]);
    prisma.availabilityException.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const result = await service.getPublicSlots('tenant-1', {
      serviceId: 'service-1',
      staffId: 'staff-1',
      date
    });

    expect(result.slots).toHaveLength(3);
    expect(result.slots[0].startAt).toContain('T09:00:00.000Z');
    expect(result.slots[1].startAt).toContain('T09:15:00.000Z');
    expect(result.slots[2].startAt).toContain('T09:30:00.000Z');
  });

  it('bloquea slots públicos cuando hay excepción de no disponibilidad', async () => {
    const { service, prisma } = createBookingsService();

    const day = new Date(Date.UTC(2030, 0, 14, 0, 0, 0, 0));
    const date = day.toISOString().slice(0, 10);

    prisma.service.findFirst.mockResolvedValue({ id: 'service-1', durationMinutes: 30, active: true });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', active: true });
    prisma.tenant.findUnique.mockResolvedValue(defaultTenantSettings('free'));
    prisma.booking.count.mockResolvedValue(0);
    prisma.availabilityRule.findMany.mockResolvedValue([{ startTime: '09:00', endTime: '10:00' }]);
    prisma.availabilityException.findMany.mockResolvedValue([{ startTime: '09:00', endTime: '10:00' }]);
    prisma.booking.findMany.mockResolvedValue([]);

    const result = await service.getPublicSlots('tenant-1', {
      serviceId: 'service-1',
      staffId: 'staff-1',
      date
    });

    expect(result.slots).toHaveLength(0);
  });

  it('filtra slots públicos por colisiones considerando buffer', async () => {
    const { service, prisma } = createBookingsService();

    const day = new Date(Date.UTC(2030, 0, 14, 0, 0, 0, 0));
    const date = day.toISOString().slice(0, 10);

    prisma.service.findFirst.mockResolvedValue({ id: 'service-1', durationMinutes: 30, active: true });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', active: true });
    prisma.tenant.findUnique.mockResolvedValue({
      ...defaultTenantSettings('free'),
      bookingBufferMinutes: 15
    });
    prisma.booking.count.mockResolvedValue(0);
    prisma.availabilityRule.findMany.mockResolvedValue([{ startTime: '09:00', endTime: '11:00' }]);
    prisma.availabilityException.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([
      {
        startAt: new Date(Date.UTC(2030, 0, 14, 9, 30, 0, 0)),
        endAt: new Date(Date.UTC(2030, 0, 14, 10, 0, 0, 0))
      }
    ]);

    const result = await service.getPublicSlots('tenant-1', {
      serviceId: 'service-1',
      staffId: 'staff-1',
      date
    });

    const starts = result.slots.map((entry) => entry.startAt);
    expect(starts.some((value) => value.includes('T09:00:00.000Z'))).toBe(false);
    expect(starts.some((value) => value.includes('T10:15:00.000Z'))).toBe(true);
  });
});