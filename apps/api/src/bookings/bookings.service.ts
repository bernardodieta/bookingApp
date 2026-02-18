import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, PaymentMethod, PaymentStatus, Plan, Prisma, RefundPolicy, WaitlistStatus } from '@prisma/client';
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
import { DateTime } from 'luxon';
import { IntegrationsService } from '../integrations/integrations.service';

const SLOT_STEP_MINUTES = 15;

type TenantBookingFormField = {
  key?: unknown;
  name?: unknown;
  label?: unknown;
  required?: unknown;
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly integrationsService: IntegrationsService
  ) {}

  async create(user: AuthUser, payload: CreateBookingDto) {
    return this.createForTenant(user.tenantId, payload, false, user.sub);
  }

  async joinWaitlist(user: AuthUser, payload: JoinWaitlistDto) {
    return this.joinWaitlistForTenant(user.tenantId, payload);
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

    this.validateRequiredBookingFormFields(payload.customFields, tenantSettings.bookingFormFields);

    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
    await this.enforceBookingLimits(tenantId, startAt, tenantSettings.maxBookingsPerDay, tenantSettings.maxBookingsPerWeek, tenantSettings.timeZone);
    await this.enforceMonthlyPlanBookingLimit(tenantId, startAt, tenantSettings.plan, tenantSettings.timeZone);

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
        tenantSettings.timeZone,
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
        const waitlistFeedback = await this.getWaitlistFeedback(waitlistEntry.id);

        return {
          waitlisted: true,
          reason: 'Horario ocupado, agregado a lista de espera.',
          waitlistEntry,
          ...waitlistFeedback
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
      await this.integrationsService.syncGoogleOutboundForBooking({
        tenantId,
        bookingId: booking.id,
        action: 'BOOKING_CREATED',
        actorUserId
      });
    } catch {
    }

    try {
      await this.notificationsService.sendBookingCreatedEmails({
        tenantName: tenantSettings.name,
        tenantSlug: tenantSettings.slug,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        serviceName: service.name,
        staffName: staff.fullName,
        startAt: booking.startAt,
        endAt: booking.endAt,
        timeZone: tenantSettings.timeZone
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

  async runDueReminders(user: AuthUser) {
    return this.runDueRemindersForTenant(user.tenantId, user.sub);
  }

  async runDueRemindersForTenant(tenantId: string, actorUserId: string) {
    const tenantSettings = await this.getTenantSettings(tenantId);
    const reminderHoursBefore = tenantSettings.reminderHoursBefore;

    if (reminderHoursBefore <= 0) {
      return {
        reminderHoursBefore,
        timeZone: tenantSettings.timeZone,
        processed: 0,
        sent: 0,
        skippedAlreadySent: 0,
        disabled: true
      };
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() + reminderHoursBefore * 60 * 60_000);
    const windowEnd = new Date(windowStart.getTime() + 15 * 60_000);

    const dueBookings = await this.prisma.booking.findMany({
      where: {
        tenantId,
        status: {
          in: [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.rescheduled]
        },
        startAt: {
          gte: windowStart,
          lt: windowEnd
        }
      },
      include: {
        service: {
          select: { name: true }
        },
        staff: {
          select: { fullName: true }
        }
      }
    });

    if (!dueBookings.length) {
      return {
        reminderHoursBefore,
        timeZone: tenantSettings.timeZone,
        processed: 0,
        sent: 0,
        skippedAlreadySent: 0,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString()
      };
    }

    const reminderLogs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        action: 'BOOKING_REMINDER_SENT',
        entity: 'booking',
        entityId: {
          in: dueBookings.map((booking) => booking.id)
        }
      },
      select: {
        entityId: true
      }
    });

    const alreadySentBookingIds = new Set(reminderLogs.map((entry) => entry.entityId).filter((entry): entry is string => !!entry));

    let sent = 0;
    let skippedAlreadySent = 0;

    for (const booking of dueBookings) {
      if (alreadySentBookingIds.has(booking.id)) {
        skippedAlreadySent += 1;
        continue;
      }

      await this.notificationsService.sendBookingReminderEmail({
        tenantName: tenantSettings.name,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        serviceName: booking.service.name,
        staffName: booking.staff.fullName,
        startAt: booking.startAt,
        endAt: booking.endAt,
        reminderHoursBefore,
        timeZone: tenantSettings.timeZone
      });

      await this.auditService.log({
        tenantId,
        actorUserId,
        action: 'BOOKING_REMINDER_SENT',
        entity: 'booking',
        entityId: booking.id,
        metadata: {
          reminderHoursBefore,
          startAt: booking.startAt.toISOString()
        } as Prisma.InputJsonValue
      });

      sent += 1;
    }

    return {
      reminderHoursBefore,
      timeZone: tenantSettings.timeZone,
      processed: dueBookings.length,
      sent,
      skippedAlreadySent,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString()
    };
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

  async getWaitlistFeedback(waitlistEntryId: string) {
    const entry = await this.prisma.waitlistEntry.findUnique({
      where: { id: waitlistEntryId },
      include: {
        service: {
          select: {
            durationMinutes: true
          }
        }
      }
    });

    if (!entry) {
      throw new NotFoundException('Entrada de lista de espera no encontrada.');
    }

    const queuePosition = await this.prisma.waitlistEntry.count({
      where: {
        tenantId: entry.tenantId,
        serviceId: entry.serviceId,
        staffId: entry.staffId,
        status: WaitlistStatus.waiting,
        OR: [
          { preferredStartAt: { lt: entry.preferredStartAt } },
          {
            preferredStartAt: entry.preferredStartAt,
            createdAt: { lte: entry.createdAt }
          }
        ]
      }
    });

    const durationMinutes = entry.service?.durationMinutes ?? 30;
    const estimatedStartAt = entry.preferredStartAt;
    const estimatedEndAt = new Date(estimatedStartAt.getTime() + durationMinutes * 60_000);

    return {
      queuePosition: Math.max(queuePosition, 1),
      estimatedStartAt: estimatedStartAt.toISOString(),
      estimatedEndAt: estimatedEndAt.toISOString()
    };
  }

  async getPublicSlots(tenantId: string, query: PublicSlotsQueryDto) {
    const tenantSettings = await this.getTenantSettings(tenantId);
    const dayStart = this.dayStartFromIsoDate(query.date, tenantSettings.timeZone);
    const dayEnd = this.endOfDayInTimeZone(dayStart, tenantSettings.timeZone);
    const dayOfWeek = this.dayOfWeekInTimeZone(dayStart, tenantSettings.timeZone);

    const [service, staff] = await Promise.all([
      this.prisma.service.findFirst({ where: { id: query.serviceId, tenantId, active: true } }),
      this.prisma.staff.findFirst({ where: { id: query.staffId, tenantId, active: true } })
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
      tenantSettings.maxBookingsPerWeek,
      tenantSettings.timeZone
    );

    if (!canBook) {
      return {
        date: query.date,
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
      date: query.date,
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

    const refundResolution = await this.applyRefundPolicyOnCancellation(user, booking.id, tenantSettings.refundPolicy);

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'BOOKING_CANCELLED',
      entity: 'booking',
      entityId: booking.id,
      metadata: {
        reason: payload.reason ?? null,
        previousStatus: booking.status,
        refundPolicy: tenantSettings.refundPolicy,
        refundResolution
      } as Prisma.InputJsonValue
    });

    await this.notifyNextWaitlistOnCancellation(cancelled);

    try {
      await this.integrationsService.syncGoogleOutboundForBooking({
        tenantId: user.tenantId,
        bookingId: booking.id,
        action: 'BOOKING_CANCELLED',
        actorUserId: user.sub
      });
    } catch {
    }

    return {
      ...cancelled,
      refundResolution
    };
  }

  private async applyRefundPolicyOnCancellation(user: AuthUser, bookingId: string, refundPolicy: RefundPolicy) {
    const paidPayments = await this.prisma.payment.findMany({
      where: {
        tenantId: user.tenantId,
        bookingId,
        status: PaymentStatus.paid
      },
      select: {
        kind: true,
        amount: true,
        currency: true,
        customerId: true
      }
    });

    if (!paidPayments.length) {
      return {
        policy: refundPolicy,
        paidAmount: 0,
        action: 'none',
        amount: 0
      };
    }

    const paidAmount = paidPayments.reduce((acc, payment) => {
      const amount = Number(payment.amount);
      if (payment.kind === 'refund') {
        return acc - amount;
      }
      return acc + amount;
    }, 0);

    const refundableAmount = Math.max(paidAmount, 0);

    if (refundableAmount <= 0) {
      return {
        policy: refundPolicy,
        paidAmount,
        action: 'none',
        amount: 0
      };
    }

    if (refundPolicy === RefundPolicy.full) {
      const referencePayment = paidPayments.find((entry) => !!entry.customerId) ?? paidPayments[0];
      const createdRefund = await this.prisma.payment.create({
        data: {
          tenantId: user.tenantId,
          bookingId,
          customerId: referencePayment.customerId ?? null,
          kind: 'refund',
          status: 'paid',
          method: PaymentMethod.transfer,
          provider: 'manual',
          amount: refundableAmount,
          currency: referencePayment.currency,
          paidAt: new Date(),
          notes: 'Reembolso automático por cancelación según política del tenant.'
        }
      });

      await this.auditService.log({
        tenantId: user.tenantId,
        actorUserId: user.sub,
        action: 'BOOKING_REFUND_ISSUED',
        entity: 'payment',
        entityId: createdRefund.id,
        metadata: {
          bookingId,
          amount: refundableAmount,
          policy: refundPolicy
        } as Prisma.InputJsonValue
      });

      return {
        policy: refundPolicy,
        paidAmount,
        action: 'refund',
        amount: refundableAmount,
        paymentId: createdRefund.id
      };
    }

    if (refundPolicy === RefundPolicy.credit) {
      await this.auditService.log({
        tenantId: user.tenantId,
        actorUserId: user.sub,
        action: 'BOOKING_CREDIT_ISSUED',
        entity: 'booking',
        entityId: bookingId,
        metadata: {
          bookingId,
          amount: refundableAmount,
          policy: refundPolicy
        } as Prisma.InputJsonValue
      });

      return {
        policy: refundPolicy,
        paidAmount,
        action: 'credit',
        amount: refundableAmount
      };
    }

    return {
      policy: refundPolicy,
      paidAmount,
      action: 'none',
      amount: 0
    };
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
      tenantSettings.timeZone,
      booking.id
    );
    await this.enforceMonthlyPlanBookingLimit(user.tenantId, startAt, tenantSettings.plan, tenantSettings.timeZone, booking.id);
    await this.ensureSlotAvailability(
      user.tenantId,
      booking.staffId,
      startAt,
      endAt,
      tenantSettings.bookingBufferMinutes,
      tenantSettings.timeZone,
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

    try {
      await this.integrationsService.syncGoogleOutboundForBooking({
        tenantId: user.tenantId,
        bookingId: booking.id,
        action: 'BOOKING_RESCHEDULED',
        actorUserId: user.sub
      });
    } catch {
    }

    return updated;
  }

  private async ensureSlotAvailability(
    tenantId: string,
    staffId: string,
    startAt: Date,
    endAt: Date,
    bufferMinutes: number,
    timeZone: string,
    excludeBookingId?: string
  ) {
    const weekDay = this.dayOfWeekInTimeZone(startAt, timeZone);
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
            gte: this.startOfDayInTimeZone(startAt, timeZone),
            lt: this.endOfDayInTimeZone(startAt, timeZone)
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
        rescheduleNoticeHours: true,
        reminderHoursBefore: true,
        timeZone: true,
        refundPolicy: true,
        bookingFormFields: true
      }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado.');
    }

    return tenant;
  }

  private validateRequiredBookingFormFields(
    customFields: Record<string, unknown> | undefined,
    configuredFields: Prisma.JsonValue | null
  ) {
    if (!Array.isArray(configuredFields) || configuredFields.length === 0) {
      return;
    }

    const requiredFields = configuredFields
      .map((field, index) => {
        const candidate = field as TenantBookingFormField;
        const rawKey = typeof candidate.key === 'string' ? candidate.key : typeof candidate.name === 'string' ? candidate.name : '';
        const key = rawKey.trim();
        if (!key || !candidate.required) {
          return null;
        }

        const rawLabel = typeof candidate.label === 'string' ? candidate.label.trim() : '';
        return {
          key,
          label: rawLabel || key || `campo_${index + 1}`
        };
      })
      .filter((field): field is { key: string; label: string } => !!field);

    if (requiredFields.length === 0) {
      return;
    }

    const missing = requiredFields.find((field) => {
      const value = customFields?.[field.key];
      if (typeof value === 'string') {
        return value.trim().length === 0;
      }
      return value === undefined || value === null;
    });

    if (missing) {
      throw new BadRequestException(`Completa el campo requerido: ${missing.label}.`);
    }
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
            slug: true,
            timeZone: true
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
      preferredStartAt: next.preferredStartAt,
      timeZone: next.tenant.timeZone
    });
  }

  private async enforceBookingLimits(
    tenantId: string,
    startAt: Date,
    maxPerDay: number | null,
    maxPerWeek: number | null,
    timeZone: string,
    excludeBookingId?: string
  ) {
    const dayStart = this.startOfDayInTimeZone(startAt, timeZone);
    const dayEnd = this.endOfDayInTimeZone(startAt, timeZone);
    const weekStart = this.startOfWeekInTimeZone(startAt, timeZone);
    const weekEnd = this.endOfWeekInTimeZone(weekStart, timeZone);

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
    maxPerWeek: number | null,
    timeZone: string
  ) {
    const dayStart = this.startOfDayInTimeZone(startAt, timeZone);
    const dayEnd = this.endOfDayInTimeZone(startAt, timeZone);
    const weekStart = this.startOfWeekInTimeZone(startAt, timeZone);
    const weekEnd = this.endOfWeekInTimeZone(weekStart, timeZone);
    const activeStatuses = [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.rescheduled];

    const monthlyLimit = this.getMonthlyBookingLimitByPlan(plan);
    if (monthlyLimit !== null) {
      const monthStart = this.startOfMonthInTimeZone(startAt, timeZone);
      const monthEnd = this.endOfMonthInTimeZone(monthStart, timeZone);
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
    timeZone: string,
    excludeBookingId?: string
  ) {
    const monthlyLimit = this.getMonthlyBookingLimitByPlan(plan);
    if (monthlyLimit === null) {
      return;
    }

    const monthStart = this.startOfMonthInTimeZone(startAt, timeZone);
    const monthEnd = this.endOfMonthInTimeZone(monthStart, timeZone);
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

  private normalizeTimeZone(timeZone: string) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
      return timeZone;
    } catch {
      return 'UTC';
    }
  }

  private dayStartFromIsoDate(value: string, timeZone: string) {
    const zone = this.normalizeTimeZone(timeZone);
    const parsed = DateTime.fromISO(value, { zone }).startOf('day');
    if (!parsed.isValid) {
      throw new BadRequestException('date inválida, usa formato YYYY-MM-DD.');
    }
    return parsed.toUTC().toJSDate();
  }

  private dayOfWeekInTimeZone(value: Date, timeZone: string) {
    const zone = this.normalizeTimeZone(timeZone);
    const weekday = DateTime.fromJSDate(value, { zone: 'utc' }).setZone(zone).weekday;
    return weekday % 7;
  }

  private startOfDayInTimeZone(value: Date, timeZone: string) {
    const zone = this.normalizeTimeZone(timeZone);
    return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(zone).startOf('day').toUTC().toJSDate();
  }

  private endOfDayInTimeZone(value: Date, timeZone: string) {
    const zone = this.normalizeTimeZone(timeZone);
    return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(zone).startOf('day').plus({ days: 1 }).toUTC().toJSDate();
  }

  private startOfWeekInTimeZone(value: Date, timeZone: string) {
    const zone = this.normalizeTimeZone(timeZone);
    return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(zone).startOf('week').toUTC().toJSDate();
  }

  private endOfWeekInTimeZone(weekStart: Date, timeZone: string) {
    const zone = this.normalizeTimeZone(timeZone);
    return DateTime.fromJSDate(weekStart, { zone: 'utc' }).setZone(zone).plus({ days: 7 }).toUTC().toJSDate();
  }

  private startOfMonthInTimeZone(value: Date, timeZone: string) {
    const zone = this.normalizeTimeZone(timeZone);
    return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(zone).startOf('month').toUTC().toJSDate();
  }

  private endOfMonthInTimeZone(monthStart: Date, timeZone: string) {
    const zone = this.normalizeTimeZone(timeZone);
    return DateTime.fromJSDate(monthStart, { zone: 'utc' }).setZone(zone).plus({ months: 1 }).toUTC().toJSDate();
  }
}
