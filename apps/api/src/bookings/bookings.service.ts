import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Plan, Prisma, WaitlistStatus } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { minutesFromDate, minutesFromTime, overlaps } from '../common/utils/time.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PublicSlotsQueryDto } from '../public/dto/public-slots-query.dto';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { AuditService } from '../audit/audit.service';

const SLOT_STEP_MINUTES = 15;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService
  ) {}

  async create(user: AuthUser, payload: CreateBookingDto) {
    return this.createForTenant(user.tenantId, payload, false, user.sub);
  }

  async createForTenant(tenantId: string, payload: CreateBookingDto, autoWaitlistOnOccupied = false, actorUserId?: string) {
    const startAt = new Date(payload.startAt);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('startAt inválido.');
    }

    const [service, staff, tenantSettings] = await Promise.all([
      this.prisma.service.findFirst({ where: { id: payload.serviceId, tenantId, active: true } }),
      this.prisma.staff.findFirst({ where: { id: payload.staffId, tenantId, active: true } }),
      this.getTenantSettings(tenantId)
    ]);

    if (!service) {
      throw new BadRequestException('Servicio no disponible para este tenant.');
    }
    if (!staff) {
      throw new BadRequestException('Empleado no disponible para este tenant.');
    }

    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
    await this.enforceBookingLimits(tenantId, startAt, tenantSettings.maxBookingsPerDay, tenantSettings.maxBookingsPerWeek);
    await this.enforceMonthlyPlanBookingLimit(tenantId, startAt, tenantSettings.plan);

    const normalizedEmail = payload.customerEmail.toLowerCase();
    const customer = await this.prisma.customer.upsert({
      where: {
        tenantId_email: {
          tenantId,
          email: normalizedEmail
        }
      },
      update: {
        fullName: payload.customerName,
        phone:
          typeof payload.customFields?.phone === 'string' && payload.customFields.phone.trim().length > 0
            ? payload.customFields.phone.trim()
            : undefined,
        metadata: payload.customFields as Prisma.InputJsonValue | undefined
      },
      create: {
        tenantId,
        fullName: payload.customerName,
        email: normalizedEmail,
        phone:
          typeof payload.customFields?.phone === 'string' && payload.customFields.phone.trim().length > 0
            ? payload.customFields.phone.trim()
            : undefined,
        metadata: payload.customFields as Prisma.InputJsonValue | undefined
      }
    });

    try {
      await this.ensureSlotAvailability(
        tenantId,
        staff.id,
        startAt,
        endAt,
        tenantSettings.bookingBufferMinutes,
        undefined
      );
    } catch (error) {
      if (autoWaitlistOnOccupied && this.isOccupiedSlotError(error)) {
        const waitlistEntry = await this.joinWaitlistForTenant(tenantId, {
          serviceId: payload.serviceId,
          staffId: payload.staffId,
          preferredStartAt: payload.startAt,
          customerName: payload.customerName,
          customerEmail: payload.customerEmail,
          notes: payload.notes
        });

        return {
          waitlisted: true,
          reason: 'Horario ocupado, agregado a lista de espera.',
          waitlistEntry
        };
      }

      throw error;
    }

    const booking = await this.prisma.booking.create({
      data: {
        tenantId,
        customerId: customer.id,
        serviceId: service.id,
        staffId: staff.id,
        customerName: payload.customerName,
        customerEmail: normalizedEmail,
        startAt,
        endAt,
        status: BookingStatus.confirmed,
        customFields: payload.customFields as Prisma.InputJsonValue | undefined,
        notes: payload.notes
      }
    });

    await this.auditService.log({
      tenantId,
      actorUserId,
      action: 'BOOKING_CREATED',
      entity: 'booking',
      entityId: booking.id,
      metadata: {
        customerEmail: booking.customerEmail,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString()
      } as Prisma.InputJsonValue
    });

    try {
      await this.notificationsService.sendBookingCreatedEmails({
        tenantName: tenantSettings.name,
        tenantSlug: tenantSettings.slug,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        serviceName: service.name,
        staffName: staff.fullName,
        startAt: booking.startAt,
        endAt: booking.endAt
      });
    } catch {
      return booking;
    }

    return booking;
  }

  list(user: AuthUser) {
    return this.prisma.booking.findMany({
      where: { tenantId: user.tenantId },
      include: {
        service: true,
        staff: true
      },
      orderBy: { startAt: 'asc' }
    });
  }

  async joinWaitlistForTenant(tenantId: string, payload: JoinWaitlistDto) {
    const preferredStartAt = new Date(payload.preferredStartAt);
    if (Number.isNaN(preferredStartAt.getTime())) {
      throw new BadRequestException('preferredStartAt inválido.');
    }

    const [service, staff] = await Promise.all([
      this.prisma.service.findFirst({ where: { id: payload.serviceId, tenantId, active: true } }),
      this.prisma.staff.findFirst({ where: { id: payload.staffId, tenantId, active: true } })
    ]);

    if (!service) {
      throw new BadRequestException('serviceId no válido para este negocio.');
    }
    if (!staff) {
      throw new BadRequestException('staffId no válido para este negocio.');
    }

    const existing = await this.prisma.waitlistEntry.findFirst({
      where: {
        tenantId,
        serviceId: service.id,
        staffId: staff.id,
        customerEmail: payload.customerEmail.toLowerCase(),
        preferredStartAt,
        status: WaitlistStatus.waiting
      }
    });

    if (existing) {
      return existing;
    }

    return this.prisma.waitlistEntry.create({
      data: {
        tenantId,
        serviceId: service.id,
        staffId: staff.id,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail.toLowerCase(),
        preferredStartAt,
        status: WaitlistStatus.waiting,
        notes: payload.notes
      }
    });
  }

  async getPublicSlots(tenantId: string, query: PublicSlotsQueryDto) {
    const dayStart = this.dayStartFromIsoDate(query.date);
    const dayEnd = this.endOfDayUtc(dayStart);
    const dayOfWeek = dayStart.getUTCDay();

    const [service, staff, tenantSettings] = await Promise.all([
      this.prisma.service.findFirst({ where: { id: query.serviceId, tenantId, active: true } }),
      this.prisma.staff.findFirst({ where: { id: query.staffId, tenantId, active: true } }),
      this.getTenantSettings(tenantId)
    ]);

    if (!service) {
      throw new BadRequestException('serviceId no válido para este negocio.');
    }
    if (!staff) {
      throw new BadRequestException('staffId no válido para este negocio.');
    }

    const canBook = await this.canAcceptMoreBookingsForDate(
      tenantId,
      dayStart,
      tenantSettings.plan,
      tenantSettings.maxBookingsPerDay,
      tenantSettings.maxBookingsPerWeek
    );

    if (!canBook) {
      return {
        date: dayStart.toISOString().slice(0, 10),
        serviceId: service.id,
        staffId: staff.id,
        slots: []
      };
    }

    const [rules, exceptions, bookings] = await Promise.all([
      this.prisma.availabilityRule.findMany({
        where: {
          tenantId,
          dayOfWeek,
          isActive: true,
          OR: [{ staffId: staff.id }, { staffId: null }]
        },
        orderBy: { startTime: 'asc' }
      }),
      this.prisma.availabilityException.findMany({
        where: {
          tenantId,
          OR: [{ staffId: staff.id }, { staffId: null }],
          isUnavailable: true,
          date: {
            gte: dayStart,
            lt: dayEnd
          }
        }
      }),
      this.prisma.booking.findMany({
        where: {
          tenantId,
          staffId: staff.id,
          status: {
            in: [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.rescheduled]
          },
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart }
        }
      })
    ]);

    const unique = new Map<string, { startAt: string; endAt: string }>();

    for (const rule of rules) {
      const ruleStart = minutesFromTime(rule.startTime);
      const ruleEnd = minutesFromTime(rule.endTime);
      const duration = service.durationMinutes;

      for (let cursor = ruleStart; cursor + duration <= ruleEnd; cursor += SLOT_STEP_MINUTES) {
        const slotStart = new Date(dayStart.getTime() + cursor * 60_000);
        const slotEnd = new Date(slotStart.getTime() + duration * 60_000);

        const blockedByException = exceptions.some((exception) => {
          if (!exception.startTime || !exception.endTime) {
            return true;
          }
          const exceptionStart = minutesFromTime(exception.startTime);
          const exceptionEnd = minutesFromTime(exception.endTime);
          return overlaps(cursor, cursor + duration, exceptionStart, exceptionEnd);
        });

        if (blockedByException) {
          continue;
        }

        if (this.hasBookingCollision(bookings, slotStart, slotEnd, tenantSettings.bookingBufferMinutes)) {
          continue;
        }

        unique.set(slotStart.toISOString(), {
          startAt: slotStart.toISOString(),
          endAt: slotEnd.toISOString()
        });
      }
    }

    return {
      date: dayStart.toISOString().slice(0, 10),
      serviceId: service.id,
      staffId: staff.id,
      slots: [...unique.values()].sort((a, b) => a.startAt.localeCompare(b.startAt))
    };
  }

  async cancel(user: AuthUser, bookingId: string, payload: CancelBookingDto) {
    const [booking, tenantSettings] = await Promise.all([
      this.prisma.booking.findFirst({ where: { id: bookingId, tenantId: user.tenantId } }),
      this.getTenantSettings(user.tenantId)
    ]);

    if (!booking) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    if (booking.status === BookingStatus.cancelled) {
      return booking;
    }
    if (booking.status === BookingStatus.completed || booking.status === BookingStatus.no_show) {
      throw new BadRequestException('No se puede cancelar una reserva finalizada.');
    }

    this.ensureNoticeWindow(booking.startAt, tenantSettings.cancellationNoticeHours, 'cancelar');

    const cancelled = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.cancelled,
        cancelledAt: new Date(),
        cancellationReason: payload.reason ?? null
      }
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'BOOKING_CANCELLED',
      entity: 'booking',
      entityId: booking.id,
      metadata: {
        reason: payload.reason ?? null,
        previousStatus: booking.status
      } as Prisma.InputJsonValue
    });

    await this.notifyNextWaitlistOnCancellation(cancelled);
    return cancelled;
  }

  async reschedule(user: AuthUser, bookingId: string, payload: RescheduleBookingDto) {
    const startAt = new Date(payload.startAt);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('startAt inválido.');
    }

    const [booking, tenantSettings, service] = await Promise.all([
      this.prisma.booking.findFirst({ where: { id: bookingId, tenantId: user.tenantId } }),
      this.getTenantSettings(user.tenantId),
      this.prisma.booking.findFirst({ where: { id: bookingId, tenantId: user.tenantId }, include: { service: true } })
    ]);

    if (!booking || !service) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    if (
      booking.status === BookingStatus.cancelled ||
      booking.status === BookingStatus.completed ||
      booking.status === BookingStatus.no_show
    ) {
      throw new BadRequestException('Esta reserva no puede reprogramarse.');
    }

    this.ensureNoticeWindow(booking.startAt, tenantSettings.rescheduleNoticeHours, 'reprogramar');

    const endAt = new Date(startAt.getTime() + service.service.durationMinutes * 60_000);
    await this.enforceBookingLimits(
      user.tenantId,
      startAt,
      tenantSettings.maxBookingsPerDay,
      tenantSettings.maxBookingsPerWeek,
      booking.id
    );
    await this.enforceMonthlyPlanBookingLimit(user.tenantId, startAt, tenantSettings.plan, booking.id);
    await this.ensureSlotAvailability(
      user.tenantId,
      booking.staffId,
      startAt,
      endAt,
      tenantSettings.bookingBufferMinutes,
      booking.id
    );

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        startAt,
        endAt,
        status: BookingStatus.rescheduled
      }
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'BOOKING_RESCHEDULED',
      entity: 'booking',
      entityId: booking.id,
      metadata: {
        previousStartAt: booking.startAt.toISOString(),
        newStartAt: startAt.toISOString()
      } as Prisma.InputJsonValue
    });

    return updated;
  }

  private async ensureSlotAvailability(
    tenantId: string,
    staffId: string,
    startAt: Date,
    endAt: Date,
    bufferMinutes: number,
    excludeBookingId?: string
  ) {
    const weekDay = startAt.getUTCDay();
    const startMinutes = minutesFromDate(startAt);
    const endMinutes = minutesFromDate(endAt);
    const bufferMs = bufferMinutes * 60_000;
    const overlapStart = new Date(startAt.getTime() - bufferMs);
    const overlapEnd = new Date(endAt.getTime() + bufferMs);

    const [rules, exceptions, overlappingBooking] = await Promise.all([
      this.prisma.availabilityRule.findMany({
        where: {
          tenantId,
          dayOfWeek: weekDay,
          isActive: true,
          OR: [{ staffId }, { staffId: null }]
        }
      }),
      this.prisma.availabilityException.findMany({
        where: {
          tenantId,
          OR: [{ staffId }, { staffId: null }],
          date: {
            gte: this.startOfDayUtc(startAt),
            lt: this.endOfDayUtc(startAt)
          },
          isUnavailable: true
        }
      }),
      this.prisma.booking.findFirst({
        where: {
          tenantId,
          staffId,
          ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
          status: {
            in: [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.rescheduled]
          },
          startAt: { lt: overlapEnd },
          endAt: { gt: overlapStart }
        }
      })
    ]);

    if (overlappingBooking) {
      throw new BadRequestException('El horario ya está ocupado para este empleado.');
    }

    const fitsRule = rules.some((rule) => {
      const ruleStart = minutesFromTime(rule.startTime);
      const ruleEnd = minutesFromTime(rule.endTime);
      return startMinutes >= ruleStart && endMinutes <= ruleEnd;
    });

    if (!fitsRule) {
      throw new BadRequestException('El horario está fuera de la disponibilidad configurada.');
    }

    const blockedByException = exceptions.some((exception) => {
      if (!exception.startTime || !exception.endTime) {
        return true;
      }
      const exceptionStart = minutesFromTime(exception.startTime);
      const exceptionEnd = minutesFromTime(exception.endTime);
      return overlaps(startMinutes, endMinutes, exceptionStart, exceptionEnd);
    });

    if (blockedByException) {
      throw new BadRequestException('El horario está bloqueado por una excepción de disponibilidad.');
    }
  }

  private async getTenantSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        slug: true,
        plan: true,
        bookingBufferMinutes: true,
        maxBookingsPerDay: true,
        maxBookingsPerWeek: true,
        cancellationNoticeHours: true,
        rescheduleNoticeHours: true
      }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado.');
    }

    return tenant;
  }

  private isOccupiedSlotError(error: unknown) {
    if (!(error instanceof BadRequestException)) {
      return false;
    }
    const response = error.getResponse();
    const message = typeof response === 'string' ? response : (response as { message?: string }).message;
    return typeof message === 'string' && message.includes('ocupado');
  }

  private async notifyNextWaitlistOnCancellation(cancelledBooking: {
    tenantId: string;
    serviceId: string;
    staffId: string;
    startAt: Date;
    endAt: Date;
  }) {
    const next = await this.prisma.waitlistEntry.findFirst({
      where: {
        tenantId: cancelledBooking.tenantId,
        serviceId: cancelledBooking.serviceId,
        staffId: cancelledBooking.staffId,
        status: WaitlistStatus.waiting,
        preferredStartAt: {
          gte: cancelledBooking.startAt,
          lt: cancelledBooking.endAt
        }
      },
      orderBy: { createdAt: 'asc' },
      include: {
        service: true,
        staff: true,
        tenant: {
          select: {
            slug: true
          }
        }
      }
    });

    if (!next) {
      return;
    }

    await this.prisma.waitlistEntry.update({
      where: { id: next.id },
      data: {
        status: WaitlistStatus.notified,
        notifiedAt: new Date()
      }
    });

    await this.notificationsService.sendWaitlistSlotAvailableEmail({
      tenantSlug: next.tenant.slug,
      customerName: next.customerName,
      customerEmail: next.customerEmail,
      serviceName: next.service.name,
      staffName: next.staff.fullName,
      preferredStartAt: next.preferredStartAt
    });
  }

  private async enforceBookingLimits(
    tenantId: string,
    startAt: Date,
    maxPerDay: number | null,
    maxPerWeek: number | null,
    excludeBookingId?: string
  ) {
    const dayStart = this.startOfDayUtc(startAt);
    const dayEnd = this.endOfDayUtc(startAt);
    const weekStart = this.startOfWeekUtc(startAt);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const activeStatuses = [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.rescheduled];

    if (maxPerDay) {
      const dayCount = await this.prisma.booking.count({
        where: {
          tenantId,
          ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
          status: { in: activeStatuses },
          startAt: { gte: dayStart, lt: dayEnd }
        }
      });
      if (dayCount >= maxPerDay) {
        throw new BadRequestException('Se alcanzó el máximo de reservas por día.');
      }
    }

    if (maxPerWeek) {
      const weekCount = await this.prisma.booking.count({
        where: {
          tenantId,
          ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
          status: { in: activeStatuses },
          startAt: { gte: weekStart, lt: weekEnd }
        }
      });
      if (weekCount >= maxPerWeek) {
        throw new BadRequestException('Se alcanzó el máximo de reservas por semana.');
      }
    }
  }

  private async canAcceptMoreBookingsForDate(
    tenantId: string,
    startAt: Date,
    plan: Plan,
    maxPerDay: number | null,
    maxPerWeek: number | null
  ) {
    const dayStart = this.startOfDayUtc(startAt);
    const dayEnd = this.endOfDayUtc(startAt);
    const weekStart = this.startOfWeekUtc(startAt);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const activeStatuses = [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.rescheduled];

    const monthlyLimit = this.getMonthlyBookingLimitByPlan(plan);
    if (monthlyLimit !== null) {
      const monthStart = this.startOfMonthUtc(startAt);
      const monthEnd = this.endOfMonthUtc(monthStart);
      const monthCount = await this.prisma.booking.count({
        where: {
          tenantId,
          status: { in: activeStatuses },
          startAt: { gte: monthStart, lt: monthEnd }
        }
      });
      if (monthCount >= monthlyLimit) {
        return false;
      }
    }

    if (maxPerDay) {
      const dayCount = await this.prisma.booking.count({
        where: {
          tenantId,
          status: { in: activeStatuses },
          startAt: { gte: dayStart, lt: dayEnd }
        }
      });
      if (dayCount >= maxPerDay) {
        return false;
      }
    }

    if (maxPerWeek) {
      const weekCount = await this.prisma.booking.count({
        where: {
          tenantId,
          status: { in: activeStatuses },
          startAt: { gte: weekStart, lt: weekEnd }
        }
      });
      if (weekCount >= maxPerWeek) {
        return false;
      }
    }

    return true;
  }

  private async enforceMonthlyPlanBookingLimit(
    tenantId: string,
    startAt: Date,
    plan: Plan,
    excludeBookingId?: string
  ) {
    const monthlyLimit = this.getMonthlyBookingLimitByPlan(plan);
    if (monthlyLimit === null) {
      return;
    }

    const monthStart = this.startOfMonthUtc(startAt);
    const monthEnd = this.endOfMonthUtc(monthStart);
    const activeStatuses = [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.rescheduled];

    const monthCount = await this.prisma.booking.count({
      where: {
        tenantId,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        status: { in: activeStatuses },
        startAt: { gte: monthStart, lt: monthEnd }
      }
    });

    if (monthCount >= monthlyLimit) {
      throw new BadRequestException(
        `Se alcanzó el máximo mensual de citas para el plan ${plan} (${monthlyLimit}/mes).`
      );
    }
  }

  private getMonthlyBookingLimitByPlan(plan: Plan) {
    if (plan === 'free') {
      return 50;
    }

    return null;
  }

  private hasBookingCollision(bookings: Array<{ startAt: Date; endAt: Date }>, slotStart: Date, slotEnd: Date, bufferMinutes: number) {
    const bufferMs = bufferMinutes * 60_000;
    const overlapStart = new Date(slotStart.getTime() - bufferMs);
    const overlapEnd = new Date(slotEnd.getTime() + bufferMs);
    return bookings.some((booking) => booking.startAt < overlapEnd && booking.endAt > overlapStart);
  }

  private ensureNoticeWindow(bookingStart: Date, requiredHours: number, action: 'cancelar' | 'reprogramar') {
    if (!requiredHours) {
      return;
    }

    const minAllowed = new Date(bookingStart.getTime() - requiredHours * 60 * 60 * 1000);
    if (new Date() > minAllowed) {
      throw new BadRequestException(
        `No se puede ${action} con menos de ${requiredHours} horas de anticipación.`
      );
    }
  }

  private startOfWeekUtc(value: Date) {
    const date = this.startOfDayUtc(value);
    const day = date.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setUTCDate(date.getUTCDate() + diff);
    return date;
  }

  private dayStartFromIsoDate(value: string) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('date inválida, usa formato YYYY-MM-DD.');
    }
    parsed.setUTCHours(0, 0, 0, 0);
    return parsed;
  }

  private startOfMonthUtc(value: Date) {
    const date = this.startOfDayUtc(value);
    date.setUTCDate(1);
    return date;
  }

  private endOfMonthUtc(monthStart: Date) {
    const end = new Date(monthStart);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return end;
  }

  private startOfDayUtc(value: Date) {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private endOfDayUtc(value: Date) {
    const date = new Date(value);
    date.setUTCHours(24, 0, 0, 0);
    return date;
  }
}
