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
