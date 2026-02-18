import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { BookingStatus, CalendarAccount, CalendarProvider, CalendarSyncJobStatus, Prisma } from '@prisma/client';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { AuthUser } from '../common/types/auth-user.type';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectGoogleCalendarDto } from './dto/connect-google-calendar.dto';
import { ConnectMicrosoftCalendarDto } from './dto/connect-microsoft-calendar.dto';
import { CalendarConflictsQueryDto } from './dto/calendar-conflicts-query.dto';
import { CalendarMetricsQueryDto } from './dto/calendar-metrics-query.dto';
import { ResolveCalendarConflictDto } from './dto/resolve-calendar-conflict.dto';

type ConnectCalendarInput = {
  staffId: string;
  externalAccountId: string;
  calendarId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
};

type CalendarOutboundAction = 'BOOKING_CREATED' | 'BOOKING_RESCHEDULED' | 'BOOKING_CANCELLED';

type CalendarOAuthState = {
  tenantId: string;
  actorUserId: string;
  actorEmail: string;
  staffId: string;
  provider: CalendarProvider;
};

const DEFAULT_CALENDAR_SYNC_MAX_ATTEMPTS = 5;
const MAX_CALENDAR_SYNC_BATCH_SIZE = 50;

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

  async createGoogleAuthorizeUrl(user: AuthUser, staffId: string) {
    await this.requireTenantStaff(user.tenantId, staffId);

    const clientId = this.requireEnv('GOOGLE_CALENDAR_CLIENT_ID');
    const redirectUri = this.requireEnv('GOOGLE_CALENDAR_REDIRECT_URI');
    const scopes = (process.env.GOOGLE_CALENDAR_SCOPES?.trim() ||
      'openid email profile https://www.googleapis.com/auth/calendar').trim();

    const state = this.issueOAuthState({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      actorEmail: user.email,
      staffId,
      provider: 'google'
    });

    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      scope: scopes,
      state
    });

    return {
      provider: 'google',
      authorizeUrl: `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`,
      staffId
    };
  }

  async handleGoogleOAuthCallback(input: {
    code?: string;
    state?: string;
    error?: string;
  }) {
    if (input.error) {
      throw new BadRequestException(`Google OAuth rechazado: ${input.error}`);
    }
    if (!input.code || !input.state) {
      throw new BadRequestException('Callback de Google incompleto (code/state).');
    }

    const state = this.verifyOAuthState(input.state, 'google');
    const clientId = this.requireEnv('GOOGLE_CALENDAR_CLIENT_ID');
    const clientSecret = this.requireEnv('GOOGLE_CALENDAR_CLIENT_SECRET');
    const redirectUri = this.requireEnv('GOOGLE_CALENDAR_REDIRECT_URI');

    const tokenResponse = await this.exchangeGoogleAuthorizationCode({
      clientId,
      clientSecret,
      redirectUri,
      code: input.code
    });

    const userInfo = await this.fetchGoogleUserInfo(tokenResponse.accessToken);
    const calendarId = await this.fetchGooglePrimaryCalendarId(tokenResponse.accessToken);

    const account = await this.connectCalendarProvider(
      {
        tenantId: state.tenantId,
        sub: state.actorUserId,
        email: state.actorEmail
      },
      'google',
      {
        staffId: state.staffId,
        externalAccountId: userInfo.externalAccountId,
        calendarId,
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        tokenExpiresAt: tokenResponse.expiresIn
          ? new Date(Date.now() + Number(tokenResponse.expiresIn) * 1000).toISOString()
          : undefined
      }
    );

    return {
      provider: 'google',
      connected: true,
      account
    };
  }

  async createMicrosoftAuthorizeUrl(user: AuthUser, staffId: string) {
    await this.requireTenantStaff(user.tenantId, staffId);

    const clientId = this.requireEnv('MICROSOFT_CALENDAR_CLIENT_ID');
    const redirectUri = this.requireEnv('MICROSOFT_CALENDAR_REDIRECT_URI');
    const scopes = (process.env.MICROSOFT_CALENDAR_SCOPES?.trim() ||
      'openid email profile offline_access https://graph.microsoft.com/Calendars.ReadWrite').trim();

    const state = this.issueOAuthState({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      actorEmail: user.email,
      staffId,
      provider: 'microsoft'
    });

    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: scopes,
      state
    });

    return {
      provider: 'microsoft',
      authorizeUrl: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${query.toString()}`,
      staffId
    };
  }

  async handleMicrosoftOAuthCallback(input: {
    code?: string;
    state?: string;
    error?: string;
  }) {
    if (input.error) {
      throw new BadRequestException(`Microsoft OAuth rechazado: ${input.error}`);
    }
    if (!input.code || !input.state) {
      throw new BadRequestException('Callback de Microsoft incompleto (code/state).');
    }

    const state = this.verifyOAuthState(input.state, 'microsoft');
    const clientId = this.requireEnv('MICROSOFT_CALENDAR_CLIENT_ID');
    const clientSecret = this.requireEnv('MICROSOFT_CALENDAR_CLIENT_SECRET');
    const redirectUri = this.requireEnv('MICROSOFT_CALENDAR_REDIRECT_URI');
    const scopes = (process.env.MICROSOFT_CALENDAR_SCOPES?.trim() ||
      'openid email profile offline_access https://graph.microsoft.com/Calendars.ReadWrite').trim();

    const tokenResponse = await this.exchangeMicrosoftAuthorizationCode({
      clientId,
      clientSecret,
      redirectUri,
      code: input.code,
      scope: scopes
    });

    const profile = await this.fetchMicrosoftProfile(tokenResponse.accessToken);
    const calendarId = await this.fetchMicrosoftPrimaryCalendarId(tokenResponse.accessToken);

    const account = await this.connectCalendarProvider(
      {
        tenantId: state.tenantId,
        sub: state.actorUserId,
        email: state.actorEmail
      },
      'microsoft',
      {
        staffId: state.staffId,
        externalAccountId: profile.externalAccountId,
        calendarId,
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        tokenExpiresAt: tokenResponse.expiresIn
          ? new Date(Date.now() + Number(tokenResponse.expiresIn) * 1000).toISOString()
          : undefined
      }
    );

    return {
      provider: 'microsoft',
      connected: true,
      account
    };
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

  async listInboundConflicts(user: AuthUser, query: CalendarConflictsQueryDto) {
    const limit = query.limit ?? 50;

    if (query.cursor) {
      const cursorExists = await this.prisma.auditLog.findFirst({
        where: {
          id: query.cursor,
          tenantId: user.tenantId,
          action: 'CAL_SYNC_CONFLICT'
        },
        select: { id: true }
      });

      if (!cursorExists) {
        throw new BadRequestException('cursor inválido para conflictos.');
      }
    }

    const rows = await this.prisma.auditLog.findMany({
      where: {
        tenantId: user.tenantId,
        action: 'CAL_SYNC_CONFLICT'
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1
          }
        : {}),
      take: limit + 1
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    const conflictIds = page.map((entry) => entry.id);
    const resolutions = conflictIds.length
      ? await this.prisma.auditLog.findMany({
          where: {
            tenantId: user.tenantId,
            action: 'CAL_SYNC_CONFLICT_RESOLVED',
            entity: 'audit_log',
            entityId: {
              in: conflictIds
            }
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
        })
      : [];

    const resolutionMap = new Map<string, (typeof resolutions)[number]>();
    for (const resolution of resolutions) {
      if (!resolution.entityId || resolutionMap.has(resolution.entityId)) {
        continue;
      }
      resolutionMap.set(resolution.entityId, resolution);
    }

    const items = page.map((entry) => {
      const resolution = resolutionMap.get(entry.id);
      return {
        id: entry.id,
        createdAt: entry.createdAt,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        metadata: entry.metadata,
        resolved: !!resolution,
        resolution: resolution
          ? {
              id: resolution.id,
              actorUserId: resolution.actorUserId,
              createdAt: resolution.createdAt,
              metadata: resolution.metadata
            }
          : null
      };
    });

    return {
      items,
      nextCursor
    };
  }

  async getCalendarMetrics(user: AuthUser, query: CalendarMetricsQueryDto) {
    const windowDays = query.windowDays ?? 7;
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60_000);
    const now = new Date();
    const lagWarningMinutes = 6 * 60;
    const lagWarningMs = lagWarningMinutes * 60_000;

    const [accounts, queueByStatus, recentAudit] = await Promise.all([
      this.prisma.calendarAccount.findMany({
        where: {
          tenantId: user.tenantId
        },
        select: {
          provider: true,
          status: true,
          lastSyncAt: true,
          webhookExpiresAt: true,
          tokenExpiresAt: true
        }
      }),
      this.prisma.calendarSyncJob.groupBy({
        by: ['status'],
        where: {
          tenantId: user.tenantId
        },
        _count: {
          _all: true
        }
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: {
          tenantId: user.tenantId,
          createdAt: {
            gte: windowStart
          },
          action: {
            in: [
              'CAL_SYNC_ERROR',
              'CAL_SYNC_CONFLICT',
              'CAL_SYNC_DEAD_LETTER',
              'CAL_SYNC_RETRY_SCHEDULED',
              'CAL_SYNC_OUTBOUND_OK',
              'CAL_SYNC_INBOUND_OK'
            ]
          }
        },
        _count: {
          _all: true
        }
      })
    ]);

    const providers: Array<CalendarProvider> = ['google', 'microsoft'];

    const byProvider = providers.map((provider) => {
      const rows = accounts.filter((item) => item.provider === provider);
      const connected = rows.filter((item) => item.status === 'connected').length;
      const errored = rows.filter((item) => item.status === 'error').length;
      const disconnected = rows.filter((item) => item.status === 'disconnected').length;
      const stale = rows.filter((item) =>
        item.lastSyncAt ? now.getTime() - item.lastSyncAt.getTime() > lagWarningMs : true
      ).length;
      const webhookExpiringSoon = rows.filter((item) =>
        item.webhookExpiresAt ? item.webhookExpiresAt.getTime() <= now.getTime() + 60 * 60_000 : false
      ).length;
      const tokenExpiringSoon = rows.filter((item) =>
        item.tokenExpiresAt ? item.tokenExpiresAt.getTime() <= now.getTime() + 10 * 60_000 : false
      ).length;

      return {
        provider,
        totalAccounts: rows.length,
        connectedAccounts: connected,
        erroredAccounts: errored,
        disconnectedAccounts: disconnected,
        staleAccounts: stale,
        webhookExpiringSoon,
        tokenExpiringSoon
      };
    });

    const queue = {
      pending:
        queueByStatus.find((entry) => entry.status === CalendarSyncJobStatus.pending)?._count._all ?? 0,
      processing:
        queueByStatus.find((entry) => entry.status === CalendarSyncJobStatus.processing)?._count._all ?? 0,
      succeeded:
        queueByStatus.find((entry) => entry.status === CalendarSyncJobStatus.succeeded)?._count._all ?? 0,
      deadLetter:
        queueByStatus.find((entry) => entry.status === CalendarSyncJobStatus.dead_letter)?._count._all ?? 0
    };

    const actionCount = (action: string) => recentAudit.find((entry) => entry.action === action)?._count._all ?? 0;

    const freshnessMinutes = accounts
      .map((item) => (item.lastSyncAt ? Math.max(0, Math.round((now.getTime() - item.lastSyncAt.getTime()) / 60000)) : null))
      .filter((value): value is number => value !== null);

    const maxSyncLagMinutes = freshnessMinutes.length ? Math.max(...freshnessMinutes) : null;
    const avgSyncLagMinutes = freshnessMinutes.length
      ? Math.round(freshnessMinutes.reduce((acc, value) => acc + value, 0) / freshnessMinutes.length)
      : null;

    return {
      windowDays,
      generatedAt: now.toISOString(),
      byProvider,
      queue,
      incidents: {
        syncErrors: actionCount('CAL_SYNC_ERROR'),
        conflicts: actionCount('CAL_SYNC_CONFLICT'),
        deadLetters: actionCount('CAL_SYNC_DEAD_LETTER'),
        retriesScheduled: actionCount('CAL_SYNC_RETRY_SCHEDULED')
      },
      throughput: {
        outboundOk: actionCount('CAL_SYNC_OUTBOUND_OK'),
        inboundOk: actionCount('CAL_SYNC_INBOUND_OK')
      },
      lag: {
        maxSyncLagMinutes,
        avgSyncLagMinutes,
        warningThresholdMinutes: lagWarningMinutes
      }
    };
  }

  async resolveInboundConflict(user: AuthUser, conflictId: string, payload: ResolveCalendarConflictDto) {
    const conflict = await this.prisma.auditLog.findFirst({
      where: {
        id: conflictId,
        tenantId: user.tenantId,
        action: 'CAL_SYNC_CONFLICT'
      }
    });

    if (!conflict) {
      throw new NotFoundException('Conflicto no encontrado.');
    }

    const alreadyResolved = await this.prisma.auditLog.findFirst({
      where: {
        tenantId: user.tenantId,
        action: 'CAL_SYNC_CONFLICT_RESOLVED',
        entity: 'audit_log',
        entityId: conflict.id
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });

    if (alreadyResolved) {
      return {
        ok: true,
        alreadyResolved: true,
        resolutionId: alreadyResolved.id
      };
    }

    let retryResult: { provider: CalendarProvider; accountId: string; eventsPulled: number; bookingsUpdated: number } | null =
      null;

    if (payload.action === 'retry_sync') {
      const retryTarget = await this.extractRetrySyncTarget(user.tenantId, conflict);

      if (!retryTarget) {
        throw new BadRequestException('Este conflicto no tiene cuenta asociada para retry_sync.');
      }

      if (retryTarget.provider === 'google') {
        const result = await this.syncGoogleInboundForAccount(retryTarget.accountId);
        retryResult = {
          provider: 'google',
          accountId: retryTarget.accountId,
          eventsPulled: result.eventsPulled,
          bookingsUpdated: result.bookingsUpdated
        };
      } else {
        const result = await this.syncMicrosoftInboundForAccount(retryTarget.accountId);
        retryResult = {
          provider: 'microsoft',
          accountId: retryTarget.accountId,
          eventsPulled: result.eventsPulled,
          bookingsUpdated: result.bookingsUpdated
        };
      }
    }

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'CAL_SYNC_CONFLICT_RESOLVED',
      entity: 'audit_log',
      entityId: conflict.id,
      metadata: {
        resolutionAction: payload.action,
        note: payload.note ?? null,
        retryResult
      } as Prisma.InputJsonValue
    });

    return {
      ok: true,
      alreadyResolved: false,
      action: payload.action,
      retryResult
    };
  }

  async previewInboundConflict(user: AuthUser, conflictId: string) {
    const conflict = await this.prisma.auditLog.findFirst({
      where: {
        id: conflictId,
        tenantId: user.tenantId,
        action: 'CAL_SYNC_CONFLICT'
      }
    });

    if (!conflict) {
      throw new NotFoundException('Conflicto no encontrado.');
    }

    const metadata = this.asJsonObject(conflict.metadata);
    const reason = typeof metadata?.reason === 'string' ? metadata.reason : 'unknown';
    const provider =
      typeof metadata?.provider === 'string' && (metadata.provider === 'google' || metadata.provider === 'microsoft')
        ? metadata.provider
        : null;
    const externalEventId = typeof metadata?.externalEventId === 'string' ? metadata.externalEventId : null;

    const resolution = await this.prisma.auditLog.findFirst({
      where: {
        tenantId: user.tenantId,
        action: 'CAL_SYNC_CONFLICT_RESOLVED',
        entity: 'audit_log',
        entityId: conflict.id
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });

    const retryTarget = await this.extractRetrySyncTarget(user.tenantId, conflict);
    const retryAccount = retryTarget
      ? await this.prisma.calendarAccount.findFirst({
          where: {
            id: retryTarget.accountId,
            tenantId: user.tenantId
          },
          select: {
            id: true,
            provider: true,
            status: true,
            lastSyncAt: true,
            lastError: true
          }
        })
      : null;

    const suggestedAction: 'dismiss' | 'retry_sync' = resolution
      ? 'dismiss'
      : retryTarget
        ? 'retry_sync'
        : 'dismiss';

    const impactSummary = resolution
      ? 'El conflicto ya fue resuelto; no se recomienda una nueva acción automática.'
      : suggestedAction === 'retry_sync'
        ? 'Se intentará re-ejecutar el sync inbound de la cuenta asociada. Esto puede actualizar/cancelar bookings vinculados según cambios externos.'
        : 'Se marcará el conflicto como resuelto sin reintentar sincronización automática.';

    return {
      conflict: {
        id: conflict.id,
        createdAt: conflict.createdAt,
        reason,
        provider,
        entity: conflict.entity,
        entityId: conflict.entityId,
        externalEventId
      },
      resolved: !!resolution,
      resolution: resolution
        ? {
            id: resolution.id,
            actorUserId: resolution.actorUserId,
            createdAt: resolution.createdAt,
            metadata: resolution.metadata
          }
        : null,
      suggestedAction,
      retrySync: {
        available: !!retryTarget,
        target: retryAccount
          ? {
              accountId: retryAccount.id,
              provider: retryAccount.provider,
              status: retryAccount.status,
              lastSyncAt: retryAccount.lastSyncAt,
              lastError: retryAccount.lastError
            }
          : null
      },
      impactSummary
    };
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

    const tokenResult = await this.ensureProviderAccessToken(account, {
      forceRefresh: true,
      actorUserId: user.sub,
      reason: 'manual_resync'
    });

    const detectedCalendarId =
      account.provider === 'google'
        ? await this.fetchGooglePrimaryCalendarId(tokenResult.accessToken)
        : await this.fetchMicrosoftPrimaryCalendarId(tokenResult.accessToken);

    const renewedSubscription = await this.ensureProviderWebhookSubscription(
      {
        id: account.id,
        tenantId: account.tenantId,
        provider: account.provider,
        calendarId: detectedCalendarId,
        webhookSubscriptionId: account.webhookSubscriptionId,
        webhookResourceId: account.webhookResourceId,
        webhookExpiresAt: account.webhookExpiresAt
      },
      {
        accessToken: tokenResult.accessToken,
        actorUserId: user.sub,
        reason: 'manual_resync'
      }
    );

    const updated = await this.prisma.calendarAccount.update({
      where: { id: account.id },
      data: {
        calendarId: detectedCalendarId,
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
        calendarId: updated.calendarId,
        tokenRefreshed: tokenResult.refreshed,
        renewalCheck: 'provider_connectivity',
        webhookSubscriptionRenewed: renewedSubscription.renewed
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
    let accountIdFromToken: string | undefined;

    if (configuredToken) {
      const incoming = channelToken?.trim();
      const namespacedPrefix = `${configuredToken}:`;
      if (incoming === configuredToken) {
        accountIdFromToken = undefined;
      } else if (incoming && incoming.startsWith(namespacedPrefix)) {
        const extracted = incoming.slice(namespacedPrefix.length).trim();
        accountIdFromToken = extracted || undefined;
      } else {
        throw new UnauthorizedException('Webhook de Google no autorizado.');
      }
    }

    const accountId = accountIdFromToken ?? this.extractAccountId(body);
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

    const result = await this.syncGoogleInboundForAccount(account.id);

    return {
      received: true,
      processed: true,
      eventsPulled: result.eventsPulled,
      bookingsUpdated: result.bookingsUpdated
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
      const subscriptionId = (item.subscriptionId as string | undefined)?.trim();

      if (!accountId?.trim() && !subscriptionId) {
        continue;
      }

      const account = await this.prisma.calendarAccount.findFirst({
        where: {
          provider: 'microsoft',
          ...(accountId?.trim() ? { id: accountId.trim() } : { webhookSubscriptionId: subscriptionId })
        }
      });

      if (!account) {
        continue;
      }

      touchedAccounts.add(account.id);
      await this.syncMicrosoftInboundForAccount(account.id);
    }

    return {
      received: true,
      processed: touchedAccounts.size > 0,
      accountsTouched: touchedAccounts.size
    };
  }

  private async syncGoogleInboundForAccount(accountId: string) {
    const account = await this.prisma.calendarAccount.findFirst({
      where: {
        id: accountId,
        provider: 'google'
      }
    });

    if (!account) {
      return {
        eventsPulled: 0,
        bookingsUpdated: 0
      };
    }

    try {
      const token = await this.ensureProviderAccessToken(account, {
        reason: 'inbound_google'
      });

      const inbound = await this.pullGoogleIncrementalEvents(account, token.accessToken);
      let bookingsUpdated = 0;

      for (const item of inbound.events) {
        const applied = await this.applyInboundEventToLinkedBooking({
          account,
          provider: 'google',
          externalEventId: typeof item.id === 'string' ? item.id.trim() : '',
          externalICalUID: typeof item.iCalUID === 'string' ? item.iCalUID.trim() : undefined,
          externalVersion: this.normalizeExternalVersion(
            typeof item.etag === 'string' ? item.etag : typeof item.updated === 'string' ? item.updated : undefined
          ),
          isCancelled: item.status === 'cancelled',
          startAt: this.parseGoogleEventDate(item.start),
          endAt: this.parseGoogleEventDate(item.end)
        });

        if (applied) {
          bookingsUpdated += 1;
        }
      }

      await this.prisma.calendarAccount.update({
        where: { id: account.id },
        data: {
          syncCursor: inbound.nextSyncCursor ?? account.syncCursor,
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
          source: 'webhook',
          eventsPulled: inbound.events.length,
          bookingsUpdated,
          cursorUpdated: !!inbound.nextSyncCursor
        } as Prisma.InputJsonValue
      });

      return {
        eventsPulled: inbound.events.length,
        bookingsUpdated
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.prisma.calendarAccount.update({
        where: { id: account.id },
        data: {
          status: 'error',
          lastError: reason,
          lastSyncAt: new Date()
        }
      });

      await this.auditService.log({
        tenantId: account.tenantId,
        action: 'CAL_SYNC_ERROR',
        entity: 'calendar_account',
        entityId: account.id,
        metadata: {
          provider: 'google',
          stage: 'inbound_sync',
          error: reason
        } as Prisma.InputJsonValue
      });

      throw error;
    }
  }

  private async syncMicrosoftInboundForAccount(accountId: string) {
    const account = await this.prisma.calendarAccount.findFirst({
      where: {
        id: accountId,
        provider: 'microsoft'
      }
    });

    if (!account) {
      return {
        eventsPulled: 0,
        bookingsUpdated: 0
      };
    }

    try {
      const token = await this.ensureProviderAccessToken(account, {
        reason: 'inbound_microsoft'
      });

      const inbound = await this.pullMicrosoftIncrementalEvents(account, token.accessToken);
      let bookingsUpdated = 0;

      for (const item of inbound.events) {
        const applied = await this.applyInboundEventToLinkedBooking({
          account,
          provider: 'microsoft',
          externalEventId: typeof item.id === 'string' ? item.id.trim() : '',
          externalICalUID: typeof item.iCalUId === 'string' ? item.iCalUId.trim() : undefined,
          externalVersion: this.normalizeExternalVersion(
            typeof item['@odata.etag'] === 'string'
              ? item['@odata.etag']
              : typeof item.lastModifiedDateTime === 'string'
                ? item.lastModifiedDateTime
                : undefined
          ),
          isCancelled: item.isCancelled === true || !!item['@removed'],
          startAt: this.parseMicrosoftEventDate(item.start),
          endAt: this.parseMicrosoftEventDate(item.end)
        });

        if (applied) {
          bookingsUpdated += 1;
        }
      }

      await this.prisma.calendarAccount.update({
        where: { id: account.id },
        data: {
          syncCursor: inbound.nextSyncCursor ?? account.syncCursor,
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
          source: 'webhook',
          eventsPulled: inbound.events.length,
          bookingsUpdated,
          cursorUpdated: !!inbound.nextSyncCursor
        } as Prisma.InputJsonValue
      });

      return {
        eventsPulled: inbound.events.length,
        bookingsUpdated
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.prisma.calendarAccount.update({
        where: { id: account.id },
        data: {
          status: 'error',
          lastError: reason,
          lastSyncAt: new Date()
        }
      });

      await this.auditService.log({
        tenantId: account.tenantId,
        action: 'CAL_SYNC_ERROR',
        entity: 'calendar_account',
        entityId: account.id,
        metadata: {
          provider: 'microsoft',
          stage: 'inbound_sync',
          error: reason
        } as Prisma.InputJsonValue
      });

      throw error;
    }
  }

  async enqueueGoogleOutboundSyncJob(input: {
    tenantId: string;
    bookingId: string;
    action: CalendarOutboundAction;
    actorUserId?: string;
  }) {
    const maxAttemptsRaw = Number.parseInt(process.env.CALENDAR_SYNC_OUTBOUND_MAX_ATTEMPTS ?? '', 10);
    const maxAttempts = Number.isFinite(maxAttemptsRaw)
      ? Math.max(1, Math.min(maxAttemptsRaw, 20))
      : DEFAULT_CALENDAR_SYNC_MAX_ATTEMPTS;

    const job = await this.prisma.calendarSyncJob.create({
      data: {
        tenantId: input.tenantId,
        bookingId: input.bookingId,
        provider: 'google',
        action: input.action,
        maxAttempts,
        nextRunAt: new Date(),
        payload: {
          actorUserId: input.actorUserId ?? null
        } as Prisma.InputJsonValue
      }
    });

    await this.auditService.log({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: 'CAL_SYNC_OUTBOUND_ENQUEUED',
      entity: 'calendar_sync_job',
      entityId: job.id,
      metadata: {
        provider: 'google',
        bookingId: input.bookingId,
        bookingAction: input.action,
        maxAttempts
      } as Prisma.InputJsonValue
    });

    return {
      id: job.id,
      status: job.status,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      nextRunAt: job.nextRunAt
    };
  }

  async processDueOutboundSyncJobs(limit = 10) {
    const normalizedLimit = Math.max(1, Math.min(limit, MAX_CALENDAR_SYNC_BATCH_SIZE));
    const now = new Date();

    const dueJobs = await this.prisma.calendarSyncJob.findMany({
      where: {
        status: CalendarSyncJobStatus.pending,
        nextRunAt: {
          lte: now
        }
      },
      orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }],
      take: normalizedLimit
    });

    let processed = 0;
    let succeeded = 0;
    let retried = 0;
    let deadLettered = 0;

    for (const job of dueJobs) {
      const claimed = await this.prisma.calendarSyncJob.updateMany({
        where: {
          id: job.id,
          status: CalendarSyncJobStatus.pending,
          nextRunAt: {
            lte: now
          }
        },
        data: {
          status: CalendarSyncJobStatus.processing
        }
      });

      if (claimed.count === 0) {
        continue;
      }

      processed += 1;

      const actorUserId = this.extractActorUserIdFromJobPayload(job.payload);

      try {
        await this.syncGoogleOutboundForBooking({
          tenantId: job.tenantId,
          bookingId: job.bookingId,
          action: this.parseCalendarOutboundAction(job.action),
          actorUserId
        });

        await this.prisma.calendarSyncJob.update({
          where: { id: job.id },
          data: {
            status: CalendarSyncJobStatus.succeeded,
            attemptCount: {
              increment: 1
            },
            processedAt: new Date(),
            lastError: null
          }
        });

        succeeded += 1;
      } catch (error) {
        const nextAttempt = job.attemptCount + 1;
        const reason = error instanceof Error ? error.message : String(error);

        if (nextAttempt >= job.maxAttempts) {
          await this.prisma.calendarSyncJob.update({
            where: { id: job.id },
            data: {
              status: CalendarSyncJobStatus.dead_letter,
              attemptCount: nextAttempt,
              processedAt: new Date(),
              lastError: reason
            }
          });

          await this.auditService.log({
            tenantId: job.tenantId,
            actorUserId,
            action: 'CAL_SYNC_DEAD_LETTER',
            entity: 'calendar_sync_job',
            entityId: job.id,
            metadata: {
              provider: job.provider,
              bookingId: job.bookingId,
              bookingAction: job.action,
              attempts: nextAttempt,
              error: reason
            } as Prisma.InputJsonValue
          });

          deadLettered += 1;
        } else {
          const nextRunAt = this.computeNextRetryDate(nextAttempt);

          await this.prisma.calendarSyncJob.update({
            where: { id: job.id },
            data: {
              status: CalendarSyncJobStatus.pending,
              attemptCount: nextAttempt,
              nextRunAt,
              lastError: reason
            }
          });

          await this.auditService.log({
            tenantId: job.tenantId,
            actorUserId,
            action: 'CAL_SYNC_RETRY_SCHEDULED',
            entity: 'calendar_sync_job',
            entityId: job.id,
            metadata: {
              provider: job.provider,
              bookingId: job.bookingId,
              bookingAction: job.action,
              attempt: nextAttempt,
              nextRunAt: nextRunAt.toISOString(),
              error: reason
            } as Prisma.InputJsonValue
          });

          retried += 1;
        }
      }
    }

    return {
      picked: dueJobs.length,
      processed,
      succeeded,
      retried,
      deadLettered
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
        const tokenResult = await this.ensureProviderAccessToken(account, {
          actorUserId: input.actorUserId,
          reason: `outbound_${input.action.toLowerCase()}`
        });
        const accessToken = tokenResult.accessToken;
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
            bookingAction: input.action,
            tokenRefreshed: tokenResult.refreshed
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

  private async requireTenantStaff(tenantId: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        id: staffId,
        tenantId,
        active: true
      },
      select: { id: true }
    });

    if (!staff) {
      throw new NotFoundException('Staff no encontrado o inactivo para este tenant.');
    }
  }

  private issueOAuthState(payload: CalendarOAuthState) {
    return jwt.sign(payload, this.getOAuthStateSecret(), {
      expiresIn: '15m'
    });
  }

  private verifyOAuthState(stateToken: string, provider: CalendarProvider) {
    let payload: CalendarOAuthState;
    try {
      payload = jwt.verify(stateToken, this.getOAuthStateSecret()) as CalendarOAuthState;
    } catch {
      throw new BadRequestException('State OAuth inválido o expirado.');
    }

    if (payload.provider !== provider) {
      throw new BadRequestException('State OAuth no coincide con provider.');
    }

    if (!payload.tenantId || !payload.actorUserId || !payload.actorEmail || !payload.staffId) {
      throw new BadRequestException('State OAuth incompleto.');
    }

    return payload;
  }

  private async exchangeGoogleAuthorizationCode(input: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    const body = new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code'
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`No se pudo obtener token OAuth de Google: ${detail || response.statusText}`);
    }

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!payload.access_token) {
      throw new BadRequestException('Google OAuth no devolvió access_token.');
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in
    };
  }

  private async fetchGoogleUserInfo(accessToken: string): Promise<{
    externalAccountId: string;
    email?: string;
  }> {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`No se pudo leer perfil Google: ${detail || response.statusText}`);
    }

    const payload = (await response.json()) as {
      sub?: string;
      email?: string;
    };

    const externalAccountId = (payload.sub || payload.email || '').trim();
    if (!externalAccountId) {
      throw new BadRequestException('Google OAuth sin identificador de cuenta externa.');
    }

    return {
      externalAccountId,
      email: payload.email?.trim().toLowerCase() || undefined
    };
  }

  private async fetchGooglePrimaryCalendarId(accessToken: string) {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`No se pudo obtener calendarList de Google: ${detail || response.statusText}`);
    }

    const payload = (await response.json()) as {
      items?: Array<{ id?: string; primary?: boolean }>;
    };

    const calendars = Array.isArray(payload.items) ? payload.items : [];
    const selected = calendars.find((entry) => entry.primary && entry.id) ?? calendars.find((entry) => !!entry.id);

    if (!selected?.id) {
      throw new BadRequestException('No se encontró calendarId en cuenta Google.');
    }

    return selected.id;
  }

  private async exchangeMicrosoftAuthorizationCode(input: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
    scope: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    const body = new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
      scope: input.scope
    });

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`No se pudo obtener token OAuth de Microsoft: ${detail || response.statusText}`);
    }

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!payload.access_token) {
      throw new BadRequestException('Microsoft OAuth no devolvió access_token.');
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in
    };
  }

  private async fetchMicrosoftProfile(accessToken: string): Promise<{
    externalAccountId: string;
    userPrincipalName?: string;
  }> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,userPrincipalName', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`No se pudo leer perfil Microsoft: ${detail || response.statusText}`);
    }

    const payload = (await response.json()) as {
      id?: string;
      userPrincipalName?: string;
    };

    const externalAccountId = (payload.id || payload.userPrincipalName || '').trim();
    if (!externalAccountId) {
      throw new BadRequestException('Microsoft OAuth sin identificador de cuenta externa.');
    }

    return {
      externalAccountId,
      userPrincipalName: payload.userPrincipalName?.trim().toLowerCase() || undefined
    };
  }

  private async fetchMicrosoftPrimaryCalendarId(accessToken: string) {
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/calendars?$top=25&$select=id,name,isDefaultCalendar',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`No se pudo obtener calendarios Microsoft: ${detail || response.statusText}`);
    }

    const payload = (await response.json()) as {
      value?: Array<{ id?: string; isDefaultCalendar?: boolean }>;
    };

    const calendars = Array.isArray(payload.value) ? payload.value : [];
    const selected =
      calendars.find((entry) => entry.isDefaultCalendar && entry.id) ?? calendars.find((entry) => !!entry.id);

    if (!selected?.id) {
      throw new BadRequestException('No se encontró calendarId en cuenta Microsoft.');
    }

    return selected.id;
  }

  private async ensureProviderAccessToken(
    account: Pick<CalendarAccount, 'id' | 'tenantId' | 'provider' | 'accessTokenEncrypted' | 'refreshTokenEncrypted' | 'tokenExpiresAt'>,
    input?: {
      forceRefresh?: boolean;
      actorUserId?: string;
      reason?: string;
    }
  ): Promise<{ accessToken: string; refreshed: boolean }> {
    const forceRefresh = input?.forceRefresh === true;
    const shouldRefresh = forceRefresh || this.isAccessTokenExpiring(account.tokenExpiresAt);

    if (!shouldRefresh) {
      return {
        accessToken: this.decryptSecret(account.accessTokenEncrypted),
        refreshed: false
      };
    }

    if (!account.refreshTokenEncrypted) {
      return {
        accessToken: this.decryptSecret(account.accessTokenEncrypted),
        refreshed: false
      };
    }

    const refreshToken = this.decryptSecret(account.refreshTokenEncrypted);
    let refreshedTokens: {
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
    };
    try {
      refreshedTokens =
        account.provider === 'google'
          ? await this.refreshGoogleAccessToken(refreshToken)
          : await this.refreshMicrosoftAccessToken(refreshToken);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.prisma.calendarAccount.update({
        where: { id: account.id },
        data: {
          status: 'error',
          lastError: reason,
          lastSyncAt: new Date()
        }
      });

      await this.auditService.log({
        tenantId: account.tenantId,
        actorUserId: input?.actorUserId,
        action: 'CAL_SYNC_ERROR',
        entity: 'calendar_account',
        entityId: account.id,
        metadata: {
          provider: account.provider,
          reason: input?.reason ?? 'runtime_refresh',
          stage: 'token_refresh',
          error: reason
        } as Prisma.InputJsonValue
      });

      throw error;
    }

    const nextRefreshToken = refreshedTokens.refreshToken || refreshToken;
    const nextExpiresAt = refreshedTokens.expiresIn
      ? new Date(Date.now() + Number(refreshedTokens.expiresIn) * 1000)
      : null;

    await this.prisma.calendarAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEncrypted: this.encryptSecret(refreshedTokens.accessToken),
        refreshTokenEncrypted: this.encryptSecret(nextRefreshToken),
        tokenExpiresAt: nextExpiresAt,
        status: 'connected',
        lastError: null
      }
    });

    await this.auditService.log({
      tenantId: account.tenantId,
      actorUserId: input?.actorUserId,
      action: 'CAL_SYNC_TOKEN_REFRESHED',
      entity: 'calendar_account',
      entityId: account.id,
      metadata: {
        provider: account.provider,
        reason: input?.reason ?? 'runtime_refresh',
        expiresAt: nextExpiresAt?.toISOString() ?? null
      } as Prisma.InputJsonValue
    });

    return {
      accessToken: refreshedTokens.accessToken,
      refreshed: true
    };
  }

  private async ensureProviderWebhookSubscription(
    account: Pick<
      CalendarAccount,
      | 'id'
      | 'tenantId'
      | 'provider'
      | 'calendarId'
      | 'webhookSubscriptionId'
      | 'webhookResourceId'
      | 'webhookExpiresAt'
    >,
    input: {
      accessToken: string;
      actorUserId?: string;
      reason?: string;
    }
  ): Promise<{ renewed: boolean }> {
    const needsRenewal = this.isWebhookSubscriptionExpiring(
      account.webhookSubscriptionId,
      account.webhookExpiresAt
    );

    if (!needsRenewal) {
      return { renewed: false };
    }

    const renewalResult =
      account.provider === 'google'
        ? await this.createGoogleWebhookChannel(account, input.accessToken)
        : await this.createMicrosoftWebhookSubscription(account, input.accessToken);

    if (!renewalResult) {
      return { renewed: false };
    }

    await this.prisma.calendarAccount.update({
      where: { id: account.id },
      data: {
        webhookSubscriptionId: renewalResult.subscriptionId,
        webhookResourceId: renewalResult.resourceId,
        webhookExpiresAt: renewalResult.expiresAt,
        status: 'connected',
        lastError: null
      }
    });

    await this.auditService.log({
      tenantId: account.tenantId,
      actorUserId: input.actorUserId,
      action: 'CAL_SYNC_SUBSCRIPTION_RENEWED',
      entity: 'calendar_account',
      entityId: account.id,
      metadata: {
        provider: account.provider,
        reason: input.reason ?? 'runtime_renewal',
        subscriptionId: renewalResult.subscriptionId,
        expiresAt: renewalResult.expiresAt.toISOString()
      } as Prisma.InputJsonValue
    });

    return { renewed: true };
  }

  private isWebhookSubscriptionExpiring(subscriptionId: string | null | undefined, expiresAt: Date | null | undefined) {
    if (!subscriptionId || !expiresAt) {
      return true;
    }

    const renewalWindowMs = 30 * 60 * 1000;
    return expiresAt.getTime() <= Date.now() + renewalWindowMs;
  }

  private async createGoogleWebhookChannel(
    account: Pick<CalendarAccount, 'id' | 'calendarId'>,
    accessToken: string
  ): Promise<{ subscriptionId: string; resourceId?: string; expiresAt: Date } | null> {
    const webhookUrl = process.env.GOOGLE_CALENDAR_WEBHOOK_URL?.trim();
    if (!webhookUrl) {
      return null;
    }

    const ttlSeconds = Number(process.env.GOOGLE_CALENDAR_WEBHOOK_TTL_SECONDS ?? '604800');
    const channelId = crypto.randomUUID();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendarId)}/events/watch`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: this.buildGoogleWebhookChannelToken(account.id),
          params: {
            ttl: String(Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.trunc(ttlSeconds) : 604800)
          }
        })
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`No se pudo renovar canal Google webhook: ${detail || response.statusText}`);
    }

    const payload = (await response.json()) as {
      id?: string;
      resourceId?: string;
      expiration?: string;
    };

    const expiresAt = payload.expiration ? new Date(Number(payload.expiration)) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    return {
      subscriptionId: (payload.id || channelId).trim(),
      resourceId: payload.resourceId?.trim() || undefined,
      expiresAt
    };
  }

  private async createMicrosoftWebhookSubscription(
    account: Pick<CalendarAccount, 'calendarId'>,
    accessToken: string
  ): Promise<{ subscriptionId: string; resourceId?: string; expiresAt: Date } | null> {
    const webhookUrl = process.env.MICROSOFT_CALENDAR_WEBHOOK_URL?.trim();
    if (!webhookUrl) {
      return null;
    }

    const expirationHoursRaw = Number(process.env.MICROSOFT_CALENDAR_WEBHOOK_EXPIRATION_HOURS ?? '48');
    const expirationHours = Number.isFinite(expirationHoursRaw) && expirationHoursRaw > 0
      ? Math.min(Math.trunc(expirationHoursRaw), 70)
      : 48;
    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        changeType: 'created,updated,deleted',
        notificationUrl: webhookUrl,
        resource: `/me/calendars/${encodeURIComponent(account.calendarId)}/events`,
        expirationDateTime: expiresAt.toISOString(),
        clientState: process.env.MICROSOFT_CALENDAR_WEBHOOK_CLIENT_STATE?.trim() || undefined
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(
        `No se pudo renovar suscripción Microsoft webhook: ${detail || response.statusText}`
      );
    }

    const payload = (await response.json()) as {
      id?: string;
      resource?: string;
      expirationDateTime?: string;
    };

    const subscriptionId = payload.id?.trim();
    if (!subscriptionId) {
      throw new BadRequestException('Microsoft webhook no devolvió id de suscripción.');
    }

    return {
      subscriptionId,
      resourceId: payload.resource?.trim() || undefined,
      expiresAt: payload.expirationDateTime ? new Date(payload.expirationDateTime) : expiresAt
    };
  }

  private buildGoogleWebhookChannelToken(accountId: string) {
    const configuredToken = process.env.GOOGLE_CALENDAR_WEBHOOK_TOKEN?.trim();
    if (!configuredToken) {
      return accountId;
    }

    return `${configuredToken}:${accountId}`;
  }

  private extractActorUserIdFromJobPayload(payload: Prisma.JsonValue | null): string | undefined {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }

    const actorUserId = (payload as { actorUserId?: unknown }).actorUserId;
    if (typeof actorUserId !== 'string') {
      return undefined;
    }

    const normalized = actorUserId.trim();
    return normalized || undefined;
  }

  private parseCalendarOutboundAction(value: string): CalendarOutboundAction {
    if (value === 'BOOKING_CREATED' || value === 'BOOKING_RESCHEDULED' || value === 'BOOKING_CANCELLED') {
      return value;
    }

    throw new BadRequestException(`Acción de sync outbound inválida: ${value}`);
  }

  private computeNextRetryDate(attempt: number) {
    const baseDelayMsRaw = Number.parseInt(process.env.CALENDAR_SYNC_OUTBOUND_RETRY_BASE_MS ?? '', 10);
    const baseDelayMs = Number.isFinite(baseDelayMsRaw) ? Math.max(baseDelayMsRaw, 5_000) : 30_000;
    const maxDelayMsRaw = Number.parseInt(process.env.CALENDAR_SYNC_OUTBOUND_RETRY_MAX_MS ?? '', 10);
    const maxDelayMs = Number.isFinite(maxDelayMsRaw) ? Math.max(maxDelayMsRaw, baseDelayMs) : 60 * 60_000;

    const exponential = baseDelayMs * Math.pow(2, Math.max(attempt - 1, 0));
    const capped = Math.min(exponential, maxDelayMs);

    return new Date(Date.now() + capped);
  }

  private async extractRetrySyncTarget(
    tenantId: string,
    conflict: {
      entity: string;
      entityId: string | null;
      metadata: Prisma.JsonValue;
    }
  ): Promise<{ provider: CalendarProvider; accountId: string } | null> {
    const metadata =
      conflict.metadata && typeof conflict.metadata === 'object' && !Array.isArray(conflict.metadata)
        ? (conflict.metadata as Record<string, unknown>)
        : null;

    const providerValue = typeof metadata?.provider === 'string' ? metadata.provider : undefined;
    const provider = providerValue === 'google' || providerValue === 'microsoft' ? providerValue : undefined;
    if (!provider) {
      return null;
    }

    let accountId: string | undefined;

    if (conflict.entity === 'calendar_account' && conflict.entityId) {
      accountId = conflict.entityId;
    } else if (typeof metadata?.calendarAccountId === 'string' && metadata.calendarAccountId.trim()) {
      accountId = metadata.calendarAccountId.trim();
    }

    if (!accountId) {
      return null;
    }

    const account = await this.prisma.calendarAccount.findFirst({
      where: {
        id: accountId,
        tenantId,
        provider
      },
      select: {
        id: true
      }
    });

    if (!account) {
      return null;
    }

    return {
      provider,
      accountId: account.id
    };
  }

  private asJsonObject(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private isAccessTokenExpiring(tokenExpiresAt: Date | null | undefined) {
    if (!tokenExpiresAt) {
      return false;
    }

    const skewMs = 2 * 60 * 1000;
    return tokenExpiresAt.getTime() <= Date.now() + skewMs;
  }

  private async refreshGoogleAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    const body = new URLSearchParams({
      client_id: this.requireEnv('GOOGLE_CALENDAR_CLIENT_ID'),
      client_secret: this.requireEnv('GOOGLE_CALENDAR_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`No se pudo refrescar token de Google: ${detail || response.statusText}`);
    }

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!payload.access_token) {
      throw new BadRequestException('Google refresh no devolvió access_token.');
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in
    };
  }

  private async refreshMicrosoftAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    const body = new URLSearchParams({
      client_id: this.requireEnv('MICROSOFT_CALENDAR_CLIENT_ID'),
      client_secret: this.requireEnv('MICROSOFT_CALENDAR_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: (process.env.MICROSOFT_CALENDAR_SCOPES?.trim() ||
        'openid email profile offline_access https://graph.microsoft.com/Calendars.ReadWrite').trim()
    });

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(`No se pudo refrescar token de Microsoft: ${detail || response.statusText}`);
    }

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!payload.access_token) {
      throw new BadRequestException('Microsoft refresh no devolvió access_token.');
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in
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

  private async pullGoogleIncrementalEvents(
    account: Pick<CalendarAccount, 'id' | 'syncCursor' | 'calendarId'>,
    accessToken: string,
    forceFullSync = false
  ): Promise<{ events: Array<Record<string, unknown>>; nextSyncCursor?: string }> {
    const events: Array<Record<string, unknown>> = [];
    let pageToken: string | undefined;
    let nextSyncCursor: string | undefined;
    const useSyncToken = !forceFullSync && !!account.syncCursor;

    do {
      const query = new URLSearchParams({
        showDeleted: 'true',
        singleEvents: 'true',
        maxResults: '250'
      });

      if (useSyncToken && account.syncCursor) {
        query.set('syncToken', account.syncCursor);
      } else {
        query.set('timeMin', new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString());
        query.set('orderBy', 'updated');
      }

      if (pageToken) {
        query.set('pageToken', pageToken);
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendarId)}/events?${query.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        const detail = await response.text();
        if (response.status === 410 && useSyncToken) {
          await this.prisma.calendarAccount.update({
            where: { id: account.id },
            data: {
              syncCursor: null
            }
          });

          return this.pullGoogleIncrementalEvents(
            {
              ...account,
              syncCursor: null
            },
            accessToken,
            true
          );
        }

        throw new BadRequestException(
          `No se pudo consumir incremental de Google Calendar: ${detail || response.statusText}`
        );
      }

      const payload = (await response.json()) as {
        items?: Array<Record<string, unknown>>;
        nextPageToken?: string;
        nextSyncToken?: string;
      };

      if (Array.isArray(payload.items)) {
        events.push(...payload.items);
      }

      pageToken = payload.nextPageToken;
      nextSyncCursor = payload.nextSyncToken || nextSyncCursor;
    } while (pageToken);

    return {
      events,
      nextSyncCursor
    };
  }

  private async pullMicrosoftIncrementalEvents(
    account: Pick<CalendarAccount, 'syncCursor' | 'calendarId'>,
    accessToken: string
  ): Promise<{ events: Array<Record<string, unknown>>; nextSyncCursor?: string }> {
    const events: Array<Record<string, unknown>> = [];

    let url =
      account.syncCursor?.trim() ||
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(
        account.calendarId
      )}/events/delta?$select=id,iCalUId,start,end,isCancelled,lastModifiedDateTime`;

    let nextSyncCursor: string | undefined;

    while (url) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new BadRequestException(
          `No se pudo consumir incremental de Microsoft Calendar: ${detail || response.statusText}`
        );
      }

      const payload = (await response.json()) as {
        value?: Array<Record<string, unknown>>;
        '@odata.nextLink'?: string;
        '@odata.deltaLink'?: string;
      };

      if (Array.isArray(payload.value)) {
        events.push(...payload.value);
      }

      url = payload['@odata.nextLink'] || '';
      nextSyncCursor = payload['@odata.deltaLink'] || nextSyncCursor;
    }

    return {
      events,
      nextSyncCursor
    };
  }

  private async applyInboundEventToLinkedBooking(input: {
    account: Pick<CalendarAccount, 'id' | 'tenantId' | 'staffId'>;
    provider: CalendarProvider;
    externalEventId: string;
    externalICalUID?: string;
    externalVersion?: string;
    isCancelled: boolean;
    startAt?: Date;
    endAt?: Date;
  }) {
    const externalEventId = input.externalEventId.trim();
    if (!externalEventId) {
      return false;
    }

    const link = await this.prisma.calendarEventLink.findFirst({
      where: {
        accountId: input.account.id,
        provider: input.provider,
        OR: [
          {
            externalEventId
          },
          ...(input.externalICalUID
            ? [
                {
                  externalICalUID: input.externalICalUID
                }
              ]
            : [])
        ]
      }
    });

    if (!link) {
      return this.handleUnlinkedInboundEvent(input);
    }

    const inboundVersion = this.normalizeExternalVersion(input.externalVersion);
    if (inboundVersion && link.lastExternalVersion === inboundVersion) {
      return false;
    }

    const booking = await this.prisma.booking.findFirst({
      where: {
        id: link.bookingId,
        tenantId: input.account.tenantId
      }
    });

    if (!booking) {
      return false;
    }

    if (input.isCancelled) {
      if (booking.status === BookingStatus.cancelled) {
        await this.markInboundLinkProcessed(link.id, inboundVersion, 'synced');
        return false;
      }

      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.cancelled,
          cancelledAt: booking.cancelledAt ?? new Date(),
          cancellationReason: booking.cancellationReason || 'Sincronizado desde calendario externo'
        }
      });

      await this.markInboundLinkProcessed(link.id, inboundVersion, 'synced');

      return true;
    }

    if (!input.startAt || !input.endAt || Number.isNaN(input.startAt.getTime()) || Number.isNaN(input.endAt.getTime())) {
      await this.auditService.log({
        tenantId: input.account.tenantId,
        action: 'CAL_SYNC_CONFLICT',
        entity: 'booking',
        entityId: booking.id,
        metadata: {
          provider: input.provider,
          reason: 'invalid_external_event_time',
          externalEventId
        } as Prisma.InputJsonValue
      });

      await this.markInboundLinkProcessed(link.id, inboundVersion, 'conflict');
      return false;
    }

    if (booking.status === BookingStatus.cancelled) {
      await this.auditService.log({
        tenantId: input.account.tenantId,
        action: 'CAL_SYNC_CONFLICT',
        entity: 'booking',
        entityId: booking.id,
        metadata: {
          provider: input.provider,
          reason: 'booking_cancelled_locally',
          externalEventId
        } as Prisma.InputJsonValue
      });

      await this.markInboundLinkProcessed(link.id, inboundVersion, 'conflict');
      return false;
    }

    const startChanged = booking.startAt.getTime() !== input.startAt.getTime();
    const endChanged = booking.endAt.getTime() !== input.endAt.getTime();

    if (!startChanged && !endChanged) {
      await this.markInboundLinkProcessed(link.id, inboundVersion, 'synced');
      return false;
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        startAt: input.startAt,
        endAt: input.endAt,
        status: BookingStatus.rescheduled
      }
    });

    await this.markInboundLinkProcessed(link.id, inboundVersion, 'synced');

    return true;
  }

  private async handleUnlinkedInboundEvent(input: {
    account: Pick<CalendarAccount, 'id' | 'tenantId' | 'staffId'>;
    provider: CalendarProvider;
    externalEventId: string;
    externalICalUID?: string;
    externalVersion?: string;
    isCancelled: boolean;
    startAt?: Date;
    endAt?: Date;
  }) {
    const policy = this.getInboundUnlinkedPolicy();

    if (policy !== 'auto_create') {
      await this.auditService.log({
        tenantId: input.account.tenantId,
        action: 'CAL_SYNC_CONFLICT',
        entity: 'calendar_account',
        entityId: input.account.id,
        metadata: {
          provider: input.provider,
          reason: 'external_event_without_link',
          externalEventId: input.externalEventId,
          externalICalUID: input.externalICalUID ?? null,
          policy
        } as Prisma.InputJsonValue
      });

      return false;
    }

    if (input.isCancelled || !input.startAt || !input.endAt) {
      await this.auditService.log({
        tenantId: input.account.tenantId,
        action: 'CAL_SYNC_CONFLICT',
        entity: 'calendar_account',
        entityId: input.account.id,
        metadata: {
          provider: input.provider,
          reason: 'external_event_unlinked_not_creatable',
          externalEventId: input.externalEventId,
          policy
        } as Prisma.InputJsonValue
      });

      return false;
    }

    const service = await this.prisma.service.findFirst({
      where: {
        tenantId: input.account.tenantId,
        active: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!service) {
      await this.auditService.log({
        tenantId: input.account.tenantId,
        action: 'CAL_SYNC_CONFLICT',
        entity: 'calendar_account',
        entityId: input.account.id,
        metadata: {
          provider: input.provider,
          reason: 'external_event_unlinked_no_service',
          externalEventId: input.externalEventId,
          policy
        } as Prisma.InputJsonValue
      });

      return false;
    }

    const overlapping = await this.prisma.booking.findFirst({
      where: {
        tenantId: input.account.tenantId,
        staffId: input.account.staffId,
        status: {
          in: [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.rescheduled]
        },
        startAt: {
          lt: input.endAt
        },
        endAt: {
          gt: input.startAt
        }
      },
      select: {
        id: true
      }
    });

    if (overlapping) {
      await this.auditService.log({
        tenantId: input.account.tenantId,
        action: 'CAL_SYNC_CONFLICT',
        entity: 'calendar_account',
        entityId: input.account.id,
        metadata: {
          provider: input.provider,
          reason: 'external_event_unlinked_overlap',
          externalEventId: input.externalEventId,
          overlappingBookingId: overlapping.id,
          policy
        } as Prisma.InputJsonValue
      });

      return false;
    }

    const syntheticEmail = this.buildSyntheticExternalCustomerEmail(input.provider, input.externalEventId);
    const customer = await this.prisma.customer.upsert({
      where: {
        tenantId_email: {
          tenantId: input.account.tenantId,
          email: syntheticEmail
        }
      },
      update: {
        fullName: `External ${input.provider.toUpperCase()} Event`
      },
      create: {
        tenantId: input.account.tenantId,
        fullName: `External ${input.provider.toUpperCase()} Event`,
        email: syntheticEmail,
        metadata: {
          source: 'calendar_inbound_auto_create'
        } as Prisma.InputJsonValue
      }
    });

    const booking = await this.prisma.booking.create({
      data: {
        tenantId: input.account.tenantId,
        customerId: customer.id,
        serviceId: service.id,
        staffId: input.account.staffId,
        customerName: customer.fullName,
        customerEmail: syntheticEmail,
        startAt: input.startAt,
        endAt: input.endAt,
        status: BookingStatus.confirmed,
        notes: `Auto-creado desde evento externo ${input.provider}:${input.externalEventId}`
      }
    });

    await this.prisma.calendarEventLink.upsert({
      where: {
        accountId_provider_externalEventId: {
          accountId: input.account.id,
          provider: input.provider,
          externalEventId: input.externalEventId
        }
      },
      update: {
        bookingId: booking.id,
        externalICalUID: input.externalICalUID,
        lastExternalVersion: this.normalizeExternalVersion(input.externalVersion),
        syncStatus: 'synced',
        lastSyncedAt: new Date()
      },
      create: {
        tenantId: input.account.tenantId,
        bookingId: booking.id,
        accountId: input.account.id,
        provider: input.provider,
        externalEventId: input.externalEventId,
        externalICalUID: input.externalICalUID,
        lastExternalVersion: this.normalizeExternalVersion(input.externalVersion),
        syncStatus: 'synced',
        lastSyncedAt: new Date()
      }
    });

    await this.auditService.log({
      tenantId: input.account.tenantId,
      action: 'CAL_SYNC_INBOUND_OK',
      entity: 'booking',
      entityId: booking.id,
      metadata: {
        provider: input.provider,
        reason: 'external_event_auto_created',
        externalEventId: input.externalEventId,
        policy
      } as Prisma.InputJsonValue
    });

    return true;
  }

  private normalizeExternalVersion(value?: string | null) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized || undefined;
  }

  private async markInboundLinkProcessed(
    linkId: string,
    externalVersion: string | undefined,
    syncStatus: 'synced' | 'conflict'
  ) {
    await this.prisma.calendarEventLink.update({
      where: {
        id: linkId
      },
      data: {
        lastExternalVersion: externalVersion ?? undefined,
        syncStatus,
        lastSyncedAt: new Date()
      }
    });
  }

  private parseGoogleEventDate(value: unknown) {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const dateTime = (value as { dateTime?: unknown }).dateTime;
    if (typeof dateTime !== 'string' || !dateTime.trim()) {
      return undefined;
    }

    const parsed = new Date(dateTime);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed;
  }

  private parseMicrosoftEventDate(value: unknown) {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const dateTime = (value as { dateTime?: unknown }).dateTime;
    if (typeof dateTime !== 'string' || !dateTime.trim()) {
      return undefined;
    }

    const parsed = new Date(dateTime);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed;
  }

  private getInboundUnlinkedPolicy() {
    const raw = process.env.CALENDAR_INBOUND_UNLINKED_POLICY?.trim().toLowerCase();
    return raw === 'auto_create' ? 'auto_create' : 'conflict';
  }

  private buildSyntheticExternalCustomerEmail(provider: CalendarProvider, externalEventId: string) {
    const normalized = externalEventId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 40);
    const suffix = normalized || 'event';
    return `external.${provider}.${suffix}@calendar.apoint.local`;
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

  private getOAuthStateSecret() {
    return (
      process.env.CALENDAR_OAUTH_STATE_SECRET?.trim() ||
      process.env.JWT_ACCESS_SECRET?.trim() ||
      process.env.JWT_CUSTOMER_SECRET?.trim() ||
      'dev_calendar_oauth_state'
    );
  }

  private requireEnv(key: string) {
    const value = process.env[key]?.trim();
    if (!value) {
      throw new BadRequestException(`Configura ${key} para OAuth de integraciones calendario.`);
    }
    return value;
  }
}
