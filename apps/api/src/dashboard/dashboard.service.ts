import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DateTime } from 'luxon';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAppointments(user: AuthUser, query: DashboardQueryDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { timeZone: true }
    });
    const timeZone = this.normalizeTimeZone(tenant?.timeZone ?? 'UTC');

    const range = query.range ?? 'day';
    const baseDate = query.date ? new Date(query.date) : new Date();
    const { start, end } = this.resolvePeriod(baseDate, range, timeZone);

    const where = {
      tenantId: user.tenantId,
      startAt: { gte: start, lt: end },
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.status ? { status: query.status } : {})
    };

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        service: true,
        staff: true
      },
      orderBy: { startAt: 'asc' }
    });

    const summary = this.buildSummary(bookings);

    return {
      range,
      timeZone,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      filters: {
        staffId: query.staffId ?? null,
        status: query.status ?? null
      },
      summary,
      bookings
    };
  }

  async getReports(user: AuthUser, query: DashboardQueryDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { timeZone: true }
    });
    const timeZone = this.normalizeTimeZone(tenant?.timeZone ?? 'UTC');

    const range = query.range ?? 'day';
    const baseDate = query.date ? new Date(query.date) : new Date();
    const { start, end } = this.resolvePeriod(baseDate, range, timeZone);

    const bookings = await this.prisma.booking.findMany({
      where: {
        tenantId: user.tenantId,
        startAt: { gte: start, lt: end }
      },
      include: {
        service: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const paidPayments = await this.prisma.payment.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'paid'
      },
      select: {
        kind: true,
        amount: true,
        booking: {
          select: {
            startAt: true
          }
        }
      }
    });

    const netRevenue = paidPayments.reduce((acc, payment) => {
      const bookingStart = payment.booking.startAt;
      if (bookingStart < start || bookingStart >= end) {
        return acc;
      }

      const amount = Number(payment.amount);
      if (payment.kind === 'refund') {
        return acc - amount;
      }
      return acc + amount;
    }, 0);

    const totalAppointments = bookings.length;
    const cancelledAppointments = bookings.filter((booking) => booking.status === BookingStatus.cancelled).length;
    const cancellationRate = totalAppointments > 0 ? Number(((cancelledAppointments / totalAppointments) * 100).toFixed(2)) : 0;

    const customerMap = new Map<string, { customerName: string; customerEmail: string; totalBookings: number }>();
    for (const booking of bookings) {
      const key = booking.customerEmail.toLowerCase();
      const existing = customerMap.get(key);
      if (existing) {
        existing.totalBookings += 1;
      } else {
        customerMap.set(key, {
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          totalBookings: 1
        });
      }
    }

    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.totalBookings - a.totalBookings)
      .slice(0, 5);

    const servicesMap = new Map<string, { serviceId: string; serviceName: string; totalBookings: number }>();
    for (const booking of bookings) {
      const existing = servicesMap.get(booking.serviceId);
      if (existing) {
        existing.totalBookings += 1;
      } else {
        servicesMap.set(booking.serviceId, {
          serviceId: booking.serviceId,
          serviceName: booking.service.name,
          totalBookings: 1
        });
      }
    }

    const topServices = Array.from(servicesMap.values())
      .sort((a, b) => b.totalBookings - a.totalBookings)
      .slice(0, 5);

    const peakHoursMap = new Map<number, number>();
    for (const booking of bookings) {
      const hour = DateTime.fromJSDate(booking.startAt, { zone: 'utc' }).setZone(timeZone).hour;
      peakHoursMap.set(hour, (peakHoursMap.get(hour) ?? 0) + 1);
    }

    const peakHours = Array.from(peakHoursMap.entries())
      .map(([hour, total]) => ({ hour, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      range,
      timeZone,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      totals: {
        totalAppointments,
        cancelledAppointments,
        cancellationRate,
        netRevenue
      },
      topCustomers,
      topServices,
      peakHours
    };
  }

  private buildSummary(
    bookings: Array<{ status: BookingStatus; staffId: string; startAt: Date; endAt: Date }>
  ) {
    const byStatus = bookings.reduce<Record<string, number>>((acc, booking) => {
      acc[booking.status] = (acc[booking.status] ?? 0) + 1;
      return acc;
    }, {});

    const byStaff = bookings.reduce<Record<string, number>>((acc, booking) => {
      acc[booking.staffId] = (acc[booking.staffId] ?? 0) + 1;
      return acc;
    }, {});

    const totalMinutes = bookings.reduce((acc, booking) => {
      const duration = (booking.endAt.getTime() - booking.startAt.getTime()) / 60000;
      return acc + Math.max(duration, 0);
    }, 0);

    return {
      totalAppointments: bookings.length,
      totalScheduledMinutes: totalMinutes,
      byStatus,
      byStaff
    };
  }

  private normalizeTimeZone(timeZone: string) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
      return timeZone;
    } catch {
      return 'UTC';
    }
  }

  private startOfDayInTimeZone(value: Date, timeZone: string) {
    return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(timeZone).startOf('day').toUTC().toJSDate();
  }

  private endOfDayInTimeZone(value: Date, timeZone: string) {
    return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(timeZone).startOf('day').plus({ days: 1 }).toUTC().toJSDate();
  }

  private startOfWeekInTimeZone(value: Date, timeZone: string) {
    return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(timeZone).startOf('week').toUTC().toJSDate();
  }

  private endOfWeekInTimeZone(weekStart: Date, timeZone: string) {
    return DateTime.fromJSDate(weekStart, { zone: 'utc' }).setZone(timeZone).plus({ days: 7 }).toUTC().toJSDate();
  }

  private startOfMonthInTimeZone(value: Date, timeZone: string) {
    return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(timeZone).startOf('month').toUTC().toJSDate();
  }

  private endOfMonthInTimeZone(monthStart: Date, timeZone: string) {
    return DateTime.fromJSDate(monthStart, { zone: 'utc' }).setZone(timeZone).plus({ months: 1 }).toUTC().toJSDate();
  }

  private resolvePeriod(baseDate: Date, range: 'day' | 'week' | 'month', timeZone: string) {
    if (range === 'week') {
      const start = this.startOfWeekInTimeZone(baseDate, timeZone);
      return { start, end: this.endOfWeekInTimeZone(start, timeZone) };
    }

    if (range === 'month') {
      const start = this.startOfMonthInTimeZone(baseDate, timeZone);
      return { start, end: this.endOfMonthInTimeZone(start, timeZone) };
    }

    const start = this.startOfDayInTimeZone(baseDate, timeZone);
    return { start, end: this.endOfDayInTimeZone(start, timeZone) };
  }
}
