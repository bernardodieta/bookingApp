import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user.type';
import { minutesFromTime, assertValidTime } from '../common/utils/time.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';
import { CreateAvailabilityExceptionDto } from './dto/create-availability-exception.dto';
import { UpdateAvailabilityExceptionDto } from './dto/update-availability-exception.dto';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async createRule(user: AuthUser, payload: CreateAvailabilityRuleDto) {
    this.validateTimeWindow(payload.startTime, payload.endTime);
    await this.validateStaff(user, payload.staffId);
    await this.assertNoOverlappingRule(user.tenantId, {
      staffId: payload.staffId ?? null,
      dayOfWeek: payload.dayOfWeek,
      startTime: payload.startTime,
      endTime: payload.endTime
    });

    return this.prisma.availabilityRule.create({
      data: {
        tenantId: user.tenantId,
        staffId: payload.staffId,
        dayOfWeek: payload.dayOfWeek,
        startTime: payload.startTime,
        endTime: payload.endTime,
        isActive: payload.isActive ?? true
      }
    });
  }

  listRules(user: AuthUser) {
    return this.prisma.availabilityRule.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
    });
  }

  async updateRule(user: AuthUser, id: string, payload: UpdateAvailabilityRuleDto) {
    const rule = await this.prisma.availabilityRule.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!rule) {
      throw new NotFoundException('Regla de disponibilidad no encontrada.');
    }

    const startTime = payload.startTime ?? rule.startTime;
    const endTime = payload.endTime ?? rule.endTime;
    this.validateTimeWindow(startTime, endTime);
    await this.validateStaff(user, payload.staffId);
    if (payload.isActive ?? rule.isActive) {
      await this.assertNoOverlappingRule(
        user.tenantId,
        {
          staffId: payload.staffId !== undefined ? payload.staffId : rule.staffId,
          dayOfWeek: payload.dayOfWeek ?? rule.dayOfWeek,
          startTime,
          endTime
        },
        id
      );
    }

    return this.prisma.availabilityRule.update({
      where: { id },
      data: payload
    });
  }

  async removeRule(user: AuthUser, id: string) {
    const rule = await this.prisma.availabilityRule.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!rule) {
      throw new NotFoundException('Regla de disponibilidad no encontrada.');
    }
    return this.prisma.availabilityRule.delete({ where: { id } });
  }

  async createException(user: AuthUser, payload: CreateAvailabilityExceptionDto) {
    this.validateOptionalTimeWindow(payload.startTime, payload.endTime);
    await this.validateStaff(user, payload.staffId);

    return this.prisma.availabilityException.create({
      data: {
        tenantId: user.tenantId,
        staffId: payload.staffId,
        date: new Date(payload.date),
        startTime: payload.startTime,
        endTime: payload.endTime,
        isUnavailable: payload.isUnavailable ?? true,
        note: payload.note
      }
    });
  }

  listExceptions(user: AuthUser) {
    return this.prisma.availabilityException.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    });
  }

  async updateException(user: AuthUser, id: string, payload: UpdateAvailabilityExceptionDto) {
    const exception = await this.prisma.availabilityException.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!exception) {
      throw new NotFoundException('Excepción de disponibilidad no encontrada.');
    }

    const startTime = payload.startTime ?? exception.startTime ?? undefined;
    const endTime = payload.endTime ?? exception.endTime ?? undefined;
    this.validateOptionalTimeWindow(startTime, endTime);
    await this.validateStaff(user, payload.staffId);

    return this.prisma.availabilityException.update({
      where: { id },
      data: {
        ...payload,
        date: payload.date ? new Date(payload.date) : undefined
      }
    });
  }

  async removeException(user: AuthUser, id: string) {
    const exception = await this.prisma.availabilityException.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!exception) {
      throw new NotFoundException('Excepción de disponibilidad no encontrada.');
    }
    return this.prisma.availabilityException.delete({ where: { id } });
  }

  private async assertNoOverlappingRule(
    tenantId: string,
    candidate: { staffId: string | null; dayOfWeek: number; startTime: string; endTime: string },
    excludeId?: string
  ) {
    const sameDay = await this.prisma.availabilityRule.findMany({
      where: {
        tenantId,
        staffId: candidate.staffId,
        dayOfWeek: candidate.dayOfWeek,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });

    const start = minutesFromTime(candidate.startTime);
    const end = minutesFromTime(candidate.endTime);
    const overlapping = sameDay.find(
      (rule) => minutesFromTime(rule.startTime) < end && minutesFromTime(rule.endTime) > start
    );
    if (overlapping) {
      throw new BadRequestException(
        `Ya existe una regla activa ese día (${overlapping.startTime}–${overlapping.endTime}) que se encima con este horario.`
      );
    }
  }

  private validateTimeWindow(startTime: string, endTime: string) {
    assertValidTime(startTime, 'startTime');
    assertValidTime(endTime, 'endTime');
    if (minutesFromTime(endTime) <= minutesFromTime(startTime)) {
      throw new BadRequestException('endTime debe ser mayor a startTime.');
    }
  }

  private validateOptionalTimeWindow(startTime?: string, endTime?: string) {
    if (!startTime && !endTime) {
      return;
    }
    if (!startTime || !endTime) {
      throw new BadRequestException('startTime y endTime deben enviarse juntos.');
    }
    this.validateTimeWindow(startTime, endTime);
  }

  private async validateStaff(user: AuthUser, staffId?: string) {
    if (!staffId) {
      return;
    }
    const staff = await this.prisma.staff.findFirst({ where: { id: staffId, tenantId: user.tenantId } });
    if (!staff) {
      throw new BadRequestException('staffId no pertenece al tenant actual.');
    }
  }
}
