import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAppointments(user: AuthUser, query: DashboardQueryDto) {
    const range = query.range ?? 'day';
    const baseDate = query.date ? new Date(query.date) : new Date();
    const { start, end } = this.resolvePeriod(baseDate, range);

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
    const range = query.range ?? 'day';
    const baseDate = query.date ? new Date(query.date) : new Date();
    const { start, end } = this.resolvePeriod(baseDate, range);

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
      const hour = booking.startAt.getUTCHours();
      peakHoursMap.set(hour, (peakHoursMap.get(hour) ?? 0) + 1);
    }

    const peakHours = Array.from(peakHoursMap.entries())
      .map(([hour, total]) => ({ hour, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      range,
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

  private endOfWeekUtc(dayStart: Date) {
    const monday = this.startOfWeekUtc(dayStart);
    const end = new Date(monday);
    end.setUTCDate(end.getUTCDate() + 7);
    return end;
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

  private startOfWeekUtc(value: Date) {
    const date = this.startOfDayUtc(value);
    const day = date.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setUTCDate(date.getUTCDate() + diff);
    return date;
  }

  private resolvePeriod(baseDate: Date, range: 'day' | 'week' | 'month') {
    if (range === 'week') {
      const start = this.startOfWeekUtc(baseDate);
      return { start, end: this.endOfWeekUtc(start) };
    }

    if (range === 'month') {
      const start = this.startOfMonthUtc(baseDate);
      return { start, end: this.endOfMonthUtc(start) };
    }

    const start = this.startOfDayUtc(baseDate);
    return { start, end: this.endOfDayUtc(start) };
  }
}
