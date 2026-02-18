import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CalendarProvider, Prisma } from '@prisma/client';
import * as crypto from 'node:crypto';
import { AuthUser } from '../common/types/auth-user.type';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectGoogleCalendarDto } from './dto/connect-google-calendar.dto';
import { ConnectMicrosoftCalendarDto } from './dto/connect-microsoft-calendar.dto';

type ConnectCalendarInput = {
  staffId: string;
  externalAccountId: string;
  calendarId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
};

type CalendarOutboundAction = 'BOOKING_CREATED' | 'BOOKING_RESCHEDULED' | 'BOOKING_CANCELLED';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async connectGoogleCalendar(user: AuthUser, payload: ConnectGoogleCalendarDto) {
    return this.connectCalendarProvider(user, 'google', payload);
  }

  async connectMicrosoftCalendar(user: AuthUser, payload: ConnectMicrosoftCalendarDto) {
    return this.connectCalendarProvider(user, 'microsoft', payload);
  }

  async listCalendarAccounts(user: AuthUser) {
    const accounts = await this.prisma.calendarAccount.findMany({
      where: { tenantId: user.tenantId },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            active: true
          }
        }
      },
      orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }]
    });

    return accounts.map((account) => ({
      id: account.id,
      tenantId: account.tenantId,
      staffId: account.staffId,
      provider: account.provider,
      externalAccountId: account.externalAccountId,
      calendarId: account.calendarId,
      tokenExpiresAt: account.tokenExpiresAt,
      status: account.status,
      syncCursor: account.syncCursor,
      lastSyncAt: account.lastSyncAt,
      lastError: account.lastError,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      staff: account.staff
    }));
  }

  async requestCalendarResync(user: AuthUser, accountId: string) {
    const account = await this.prisma.calendarAccount.findFirst({
      where: {
        id: accountId,
        tenantId: user.tenantId
      }
    });

    if (!account) {
      throw new NotFoundException('Cuenta de calendario no encontrada.');
    }

    const updated = await this.prisma.calendarAccount.update({
      where: { id: account.id },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
        status: 'connected'
      }
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'CAL_SYNC_RESYNC_REQUESTED',
      entity: 'calendar_account',
      entityId: updated.id,
      metadata: {
        provider: updated.provider,
        staffId: updated.staffId,
        calendarId: updated.calendarId
      } as Prisma.InputJsonValue
    });

    return {
      ok: true,
      accountId: updated.id,
      provider: updated.provider,
      lastSyncAt: updated.lastSyncAt
    };
  }

  async disconnectCalendarAccount(user: AuthUser, accountId: string) {
    const account = await this.prisma.calendarAccount.findFirst({
      where: {
        id: accountId,
        tenantId: user.tenantId
      }
    });

    if (!account) {
      throw new NotFoundException('Cuenta de calendario no encontrada.');
    }

    await this.prisma.calendarAccount.delete({
      where: { id: account.id }
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'CAL_SYNC_DISCONNECTED',
      entity: 'calendar_account',
      entityId: account.id,
      metadata: {
        provider: account.provider,
        staffId: account.staffId,
        calendarId: account.calendarId
      } as Prisma.InputJsonValue
    });

    return { ok: true };
  }

  async handleGoogleWebhook(body: Record<string, unknown>, channelToken?: string) {
    const configuredToken = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN?.trim();
    if (configuredToken && channelToken?.trim() !== configuredToken) {
      throw new UnauthorizedException('Webhook de Google no autorizado.');
    }

    const accountId = this.extractAccountId(body);
    if (!accountId) {
      return {
        received: true,
        processed: false
      };
    }

    const account = await this.prisma.calendarAccount.findFirst({
      where: {
        id: accountId,
        provider: 'google'
      }
    });

    if (!account) {
      return {
        received: true,
        processed: false
      };
    }

    await this.prisma.calendarAccount.update({
      where: { id: account.id },
      data: {
        lastSyncAt: new Date(),
        status: 'connected',
        lastError: null
      }
    });

    await this.auditService.log({
      tenantId: account.tenantId,
      action: 'CAL_SYNC_INBOUND_OK',
      entity: 'calendar_account',
      entityId: account.id,
      metadata: {
        provider: 'google',
        source: 'webhook'
      } as Prisma.InputJsonValue
    });

    return {
      received: true,
      processed: true
    };
  }

  async handleMicrosoftWebhook(body: Record<string, unknown>) {
    const configuredClientState = process.env.MICROSOFT_CALENDAR_WEBHOOK_CLIENT_STATE?.trim();
    const notifications = Array.isArray((body as { value?: unknown[] }).value)
      ? ((body as { value: unknown[] }).value as Array<Record<string, unknown>>)
      : [];

    if (configuredClientState) {
      const invalid = notifications.some((item) => String(item.clientState ?? '') !== configuredClientState);
      if (invalid) {
        throw new UnauthorizedException('Webhook de Microsoft no autorizado.');
      }
    }

    const touchedAccounts = new Set<string>();
    for (const item of notifications) {
      const accountId =
        (item.accountId as string | undefined) ??
        (item.resourceData && typeof item.resourceData === 'object'
          ? ((item.resourceData as { accountId?: string }).accountId ?? undefined)
          : undefined);
      if (!accountId) {
        continue;
      }

      const account = await this.prisma.calendarAccount.findFirst({
        where: {
          id: accountId,
          provider: 'microsoft'
        }
      });

      if (!account) {
        continue;
      }

      touchedAccounts.add(account.id);
      await this.prisma.calendarAccount.update({
        where: { id: account.id },
        data: {
          lastSyncAt: new Date(),
          status: 'connected',
          lastError: null
        }
      });

      await this.auditService.log({
        tenantId: account.tenantId,
        action: 'CAL_SYNC_INBOUND_OK',
        entity: 'calendar_account',
        entityId: account.id,
        metadata: {
          provider: 'microsoft',
          source: 'webhook'
        } as Prisma.InputJsonValue
      });
    }

    return {
      received: true,
      processed: touchedAccounts.size > 0,
      accountsTouched: touchedAccounts.size
    };
  }

  async syncGoogleOutboundForBooking(input: {
    tenantId: string;
    bookingId: string;
    action: CalendarOutboundAction;
    actorUserId?: string;
  }) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: input.bookingId,
        tenantId: input.tenantId
      },
      include: {
        service: {
          select: {
            name: true
          }
        },
        staff: {
          select: {
            fullName: true
          }
        },
        tenant: {
          select: {
            timeZone: true,
            name: true
          }
        }
      }
    });

    if (!booking) {
      return {
        attempted: false,
        reason: 'BOOKING_NOT_FOUND'
      };
    }

    const accounts = await this.prisma.calendarAccount.findMany({
      where: {
        tenantId: input.tenantId,
        provider: 'google',
        status: 'connected',
        staffId: booking.staffId
      }
    });

    if (!accounts.length) {
      return {
        attempted: false,
        reason: 'NO_CONNECTED_ACCOUNTS'
      };
    }

    let synced = 0;
    let failed = 0;

    for (const account of accounts) {
      try {
        const accessToken = this.decryptSecret(account.accessTokenEncrypted);
        const existingLink = await this.prisma.calendarEventLink.findFirst({
          where: {
            tenantId: input.tenantId,
            bookingId: booking.id,
            accountId: account.id,
            provider: 'google'
          }
        });

        if (input.action === 'BOOKING_CANCELLED') {
          if (existingLink?.externalEventId) {
            await this.callGoogleCalendarApi({
              method: 'DELETE',
              calendarId: account.calendarId,
              accessToken,
              eventId: existingLink.externalEventId
            });
          }

          if (existingLink) {
            await this.prisma.calendarEventLink.update({
              where: { id: existingLink.id },
              data: {
                syncStatus: 'synced',
                lastSyncedAt: new Date()
              }
            });
          }
        } else {
          const payload = {
            summary: `${booking.service.name} - ${booking.customerName}`,
            description: [
              `Cliente: ${booking.customerName}`,
              `Email: ${booking.customerEmail}`,
              `Profesional: ${booking.staff.fullName}`,
              `Origen: Apoint`
            ].join('\n'),
            start: {
              dateTime: booking.startAt.toISOString(),
              timeZone: booking.tenant.timeZone ?? 'UTC'
            },
            end: {
              dateTime: booking.endAt.toISOString(),
              timeZone: booking.tenant.timeZone ?? 'UTC'
            }
          };

          const response = existingLink?.externalEventId
            ? await this.callGoogleCalendarApi<{
                id: string;
                iCalUID?: string;
                etag?: string;
              }>({
                method: 'PATCH',
                calendarId: account.calendarId,
                accessToken,
                eventId: existingLink.externalEventId,
                payload
              })
            : await this.callGoogleCalendarApi<{
                id: string;
                iCalUID?: string;
                etag?: string;
              }>({
                method: 'POST',
                calendarId: account.calendarId,
                accessToken,
                payload
              });

          if (!response?.id) {
            throw new Error('Google Calendar no devolvió id de evento.');
          }

          await this.prisma.calendarEventLink.upsert({
            where: {
              tenantId_bookingId_accountId: {
                tenantId: input.tenantId,
                bookingId: booking.id,
                accountId: account.id
              }
            },
            update: {
              provider: 'google',
              externalEventId: response.id,
              externalICalUID: response.iCalUID,
              lastExternalVersion: response.etag,
              syncStatus: 'synced',
              lastSyncedAt: new Date()
            },
            create: {
              tenantId: input.tenantId,
              bookingId: booking.id,
              accountId: account.id,
              provider: 'google',
              externalEventId: response.id,
              externalICalUID: response.iCalUID,
              lastExternalVersion: response.etag,
              syncStatus: 'synced',
              lastSyncedAt: new Date()
            }
          });
        }

        await this.prisma.calendarAccount.update({
          where: { id: account.id },
          data: {
            status: 'connected',
            lastError: null,
            lastSyncAt: new Date()
          }
        });

        await this.auditService.log({
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          action: 'CAL_SYNC_OUTBOUND_OK',
          entity: 'booking',
          entityId: booking.id,
          metadata: {
            provider: 'google',
            calendarAccountId: account.id,
            calendarId: account.calendarId,
            bookingAction: input.action
          } as Prisma.InputJsonValue
        });

        synced += 1;
      } catch (error) {
        failed += 1;

        await this.prisma.calendarAccount.update({
          where: { id: account.id },
          data: {
            status: 'error',
            lastError: error instanceof Error ? error.message : String(error),
            lastSyncAt: new Date()
          }
        });

        await this.auditService.log({
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          action: 'CAL_SYNC_ERROR',
          entity: 'booking',
          entityId: booking.id,
          metadata: {
            provider: 'google',
            calendarAccountId: account.id,
            bookingAction: input.action,
            error: error instanceof Error ? error.message : String(error)
          } as Prisma.InputJsonValue
        });
      }
    }

    return {
      attempted: true,
      totalAccounts: accounts.length,
      synced,
      failed
    };
  }

  private async connectCalendarProvider(user: AuthUser, provider: CalendarProvider, payload: ConnectCalendarInput) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        id: payload.staffId,
        tenantId: user.tenantId,
        active: true
      },
      select: { id: true }
    });

    if (!staff) {
      throw new NotFoundException('Staff no encontrado o inactivo para este tenant.');
    }

    const encryptedAccess = this.encryptSecret(payload.accessToken);
    const encryptedRefresh = payload.refreshToken ? this.encryptSecret(payload.refreshToken) : null;
    const expiresAt = payload.tokenExpiresAt ? new Date(payload.tokenExpiresAt) : null;

    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('tokenExpiresAt inválido.');
    }

    const existing = await this.prisma.calendarAccount.findFirst({
      where: {
        tenantId: user.tenantId,
        provider,
        staffId: payload.staffId,
        calendarId: payload.calendarId
      }
    });

    const account = existing
      ? await this.prisma.calendarAccount.update({
          where: { id: existing.id },
          data: {
            externalAccountId: payload.externalAccountId,
            accessTokenEncrypted: encryptedAccess,
            refreshTokenEncrypted: encryptedRefresh,
            tokenExpiresAt: expiresAt,
            status: 'connected',
            lastError: null
          }
        })
      : await this.prisma.calendarAccount.create({
          data: {
            tenantId: user.tenantId,
            staffId: payload.staffId,
            provider,
            externalAccountId: payload.externalAccountId,
            calendarId: payload.calendarId,
            accessTokenEncrypted: encryptedAccess,
            refreshTokenEncrypted: encryptedRefresh,
            tokenExpiresAt: expiresAt,
            status: 'connected'
          }
        });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'CAL_SYNC_CONNECTED',
      entity: 'calendar_account',
      entityId: account.id,
      metadata: {
        provider,
        staffId: payload.staffId,
        calendarId: payload.calendarId
      } as Prisma.InputJsonValue
    });

    return {
      id: account.id,
      tenantId: account.tenantId,
      staffId: account.staffId,
      provider: account.provider,
      externalAccountId: account.externalAccountId,
      calendarId: account.calendarId,
      tokenExpiresAt: account.tokenExpiresAt,
      status: account.status,
      syncCursor: account.syncCursor,
      lastSyncAt: account.lastSyncAt,
      lastError: account.lastError,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };
  }

  private extractAccountId(body: Record<string, unknown>) {
    const direct = body.accountId;
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }

    const nested = body.resourceData;
    if (nested && typeof nested === 'object') {
      const accountId = (nested as { accountId?: unknown }).accountId;
      if (typeof accountId === 'string' && accountId.trim()) {
        return accountId.trim();
      }
    }

    return undefined;
  }

  private async callGoogleCalendarApi<T = Record<string, unknown>>(input: {
    method: 'POST' | 'PATCH' | 'DELETE';
    calendarId: string;
    accessToken: string;
    eventId?: string;
    payload?: Record<string, unknown>;
  }) {
    const basePath = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`;
    const url = input.eventId ? `${basePath}/${encodeURIComponent(input.eventId)}` : basePath;

    const response = await fetch(url, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        ...(input.payload ? { 'Content-Type': 'application/json' } : {})
      },
      ...(input.payload ? { body: JSON.stringify(input.payload) } : {})
    });

    if (!response.ok) {
      if (input.method === 'DELETE' && response.status === 404) {
        return null;
      }

      const errorBody = await response.text();
      throw new BadRequestException(
        `Google Calendar API error (${response.status}): ${errorBody || response.statusText}`
      );
    }

    if (input.method === 'DELETE') {
      return null;
    }

    return (await response.json()) as T;
  }

  private encryptSecret(value: string) {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decryptSecret(encryptedValue: string) {
    const parts = encryptedValue.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new BadRequestException('Formato de secreto cifrado inválido.');
    }

    const [, ivBase64, authTagBase64, cipherTextBase64] = parts;
    const key = this.getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherTextBase64, 'base64')),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }

  private getEncryptionKey() {
    const secret =
      process.env.CALENDAR_TOKENS_ENCRYPTION_KEY?.trim() ||
      process.env.JWT_ACCESS_SECRET?.trim() ||
      process.env.JWT_CUSTOMER_SECRET?.trim();

    if (!secret) {
      throw new BadRequestException('Configura CALENDAR_TOKENS_ENCRYPTION_KEY para integraciones de calendario.');
    }

    return crypto.createHash('sha256').update(secret).digest();
  }
}
