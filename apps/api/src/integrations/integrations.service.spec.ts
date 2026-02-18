import { BadRequestException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

function createServiceWithMocks() {
  const prisma = {
    auditLog: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn()
    },
    calendarAccount: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      groupBy: jest.fn()
    },
    calendarSyncJob: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn()
    },
    calendarEventLink: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn()
    },
    booking: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    },
    staff: {
      findFirst: jest.fn()
    },
    service: {
      findFirst: jest.fn()
    },
    customer: {
      upsert: jest.fn()
    }
  };

  const auditService = {
    log: jest.fn()
  };

  const service = new IntegrationsService(prisma as never, auditService as never);

  return { service, prisma, auditService };
}

describe('IntegrationsService conflicts preview/resolve', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('preview sugiere retry_sync cuando hay cuenta asociada', async () => {
    const { service, prisma } = createServiceWithMocks();

    prisma.auditLog.findFirst
      .mockResolvedValueOnce({
        id: 'conflict-1',
        tenantId: 'tenant-1',
        action: 'CAL_SYNC_CONFLICT',
        entity: 'calendar_account',
        entityId: 'account-1',
        metadata: {
          provider: 'google',
          reason: 'external_event_without_link',
          externalEventId: 'evt-1'
        },
        createdAt: new Date('2026-02-18T10:00:00.000Z')
      })
      .mockResolvedValueOnce(null);

    prisma.calendarAccount.findFirst
      .mockResolvedValueOnce({ id: 'account-1' })
      .mockResolvedValueOnce({
        id: 'account-1',
        provider: 'google',
        status: 'connected',
        lastSyncAt: new Date('2026-02-18T10:05:00.000Z'),
        lastError: null
      });

    const result = await service.previewInboundConflict(
      {
        tenantId: 'tenant-1',
        sub: 'user-1',
        email: 'owner@example.com'
      },
      'conflict-1'
    );

    expect(result.suggestedAction).toBe('retry_sync');
    expect(result.retrySync.available).toBe(true);
    expect(result.retrySync.target?.accountId).toBe('account-1');
  });

  it('resolve dismiss registra CAL_SYNC_CONFLICT_RESOLVED', async () => {
    const { service, prisma, auditService } = createServiceWithMocks();

    prisma.auditLog.findFirst
      .mockResolvedValueOnce({
        id: 'conflict-2',
        tenantId: 'tenant-1',
        action: 'CAL_SYNC_CONFLICT',
        entity: 'booking',
        entityId: 'booking-1',
        metadata: {
          provider: 'google',
          reason: 'booking_cancelled_locally'
        },
        createdAt: new Date('2026-02-18T11:00:00.000Z')
      })
      .mockResolvedValueOnce(null);

    const result = await service.resolveInboundConflict(
      {
        tenantId: 'tenant-1',
        sub: 'user-1',
        email: 'owner@example.com'
      },
      'conflict-2',
      {
        action: 'dismiss',
        note: 'revisado manualmente'
      }
    );

    expect(result.ok).toBe(true);
    expect(result.alreadyResolved).toBe(false);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        action: 'CAL_SYNC_CONFLICT_RESOLVED',
        entity: 'audit_log',
        entityId: 'conflict-2'
      })
    );
  });

  it('retry_sync falla con BadRequestException si no hay target asociado', async () => {
    const { service, prisma } = createServiceWithMocks();

    prisma.auditLog.findFirst
      .mockResolvedValueOnce({
        id: 'conflict-3',
        tenantId: 'tenant-1',
        action: 'CAL_SYNC_CONFLICT',
        entity: 'booking',
        entityId: 'booking-2',
        metadata: {
          reason: 'external_event_without_link'
        },
        createdAt: new Date('2026-02-18T12:00:00.000Z')
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.resolveInboundConflict(
        {
          tenantId: 'tenant-1',
          sub: 'user-1',
          email: 'owner@example.com'
        },
        'conflict-3',
        {
          action: 'retry_sync'
        }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
