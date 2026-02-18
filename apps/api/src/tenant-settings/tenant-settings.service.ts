import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TenantSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async get(user: AuthUser) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        logoUrl: true,
        primaryColor: true,
        bookingBufferMinutes: true,
        maxBookingsPerDay: true,
        maxBookingsPerWeek: true,
        cancellationNoticeHours: true,
        rescheduleNoticeHours: true,
        reminderHoursBefore: true,
        refundPolicy: true,
        bookingFormFields: true
      }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado.');
    }

    return tenant;
  }

  async update(user: AuthUser, payload: UpdateTenantSettingsDto) {
    await this.ensureTenant(user.tenantId);

    const data: Prisma.TenantUpdateInput = {
      logoUrl: payload.logoUrl,
      primaryColor: payload.primaryColor,
      bookingBufferMinutes: payload.bookingBufferMinutes,
      maxBookingsPerDay: payload.maxBookingsPerDay,
      maxBookingsPerWeek: payload.maxBookingsPerWeek,
      cancellationNoticeHours: payload.cancellationNoticeHours,
      rescheduleNoticeHours: payload.rescheduleNoticeHours,
      reminderHoursBefore: payload.reminderHoursBefore,
      refundPolicy: payload.refundPolicy,
      bookingFormFields: payload.bookingFormFields as Prisma.InputJsonValue | undefined
    };

    const updated = await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        logoUrl: true,
        primaryColor: true,
        bookingBufferMinutes: true,
        maxBookingsPerDay: true,
        maxBookingsPerWeek: true,
        cancellationNoticeHours: true,
        rescheduleNoticeHours: true,
        reminderHoursBefore: true,
        refundPolicy: true,
        bookingFormFields: true
      }
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'TENANT_SETTINGS_UPDATED',
      entity: 'tenant',
      entityId: user.tenantId,
      metadata: Object.keys(payload) as unknown as Prisma.InputJsonValue
    });

    return updated;
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado.');
    }
  }
}
