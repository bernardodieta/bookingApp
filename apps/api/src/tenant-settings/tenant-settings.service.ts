import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
        customDomain: true,
        widgetEnabled: true,
        timeZone: true,
        locale: true,
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

    if (payload.timeZone) {
      this.ensureValidTimeZone(payload.timeZone);
    }

    const customDomain = payload.customDomain ? this.normalizeCustomDomain(payload.customDomain) : undefined;

    const data: Prisma.TenantUpdateInput = {
      logoUrl: payload.logoUrl,
      primaryColor: payload.primaryColor,
      customDomain,
      widgetEnabled: payload.widgetEnabled,
      timeZone: payload.timeZone,
      locale: payload.locale,
      bookingBufferMinutes: payload.bookingBufferMinutes,
      maxBookingsPerDay: payload.maxBookingsPerDay,
      maxBookingsPerWeek: payload.maxBookingsPerWeek,
      cancellationNoticeHours: payload.cancellationNoticeHours,
      rescheduleNoticeHours: payload.rescheduleNoticeHours,
      reminderHoursBefore: payload.reminderHoursBefore,
      refundPolicy: payload.refundPolicy,
      bookingFormFields: payload.bookingFormFields as Prisma.InputJsonValue | undefined
    };

    let updated;

    try {
      updated = await this.prisma.tenant.update({
        where: { id: user.tenantId },
        data,
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          logoUrl: true,
          primaryColor: true,
          customDomain: true,
          widgetEnabled: true,
          timeZone: true,
          locale: true,
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ese dominio ya está en uso por otro tenant.');
      }

      throw error;
    }

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

  private ensureValidTimeZone(timeZone: string) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    } catch {
      throw new BadRequestException('timeZone inválida. Usa formato IANA, por ejemplo America/Mexico_City.');
    }
  }

  private normalizeCustomDomain(customDomain: string) {
    const value = customDomain.trim().toLowerCase();

    if (!value) {
      throw new BadRequestException('customDomain no puede ser vacío.');
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      throw new BadRequestException('customDomain debe enviarse sin protocolo, por ejemplo agenda.mi-negocio.com.');
    }

    if (value.includes('/') || value.includes(':')) {
      throw new BadRequestException('customDomain solo admite hostname, sin rutas ni puertos.');
    }

    if (!/^[a-z0-9.-]+$/i.test(value) || value.startsWith('.') || value.endsWith('.') || value.includes('..')) {
      throw new BadRequestException('customDomain tiene un formato inválido.');
    }

    if (value !== 'localhost' && !value.includes('.')) {
      throw new BadRequestException('customDomain debe incluir al menos un subdominio y dominio (ej: agenda.mi-negocio.com).');
    }

    return value;
  }
}
