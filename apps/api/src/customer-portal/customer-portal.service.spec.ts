import { UnauthorizedException } from '@nestjs/common';
import { CustomerPortalService } from './customer-portal.service';

type Mocks = ReturnType<typeof createMocks>;

function createMocks() {
  const prisma = {
    tenant: {
      findFirst: jest.fn()
    },
    customer: {
      upsert: jest.fn()
    },
    $transaction: jest.fn()
  };

  const notificationsService = {
    sendCustomerPortalClaimCodeEmail: jest.fn()
  };

  const auditService = {
    log: jest.fn()
  };

  return { prisma, notificationsService, auditService };
}

function createServiceWithMocks() {
  const mocks = createMocks();
  const service = new CustomerPortalService(
    mocks.prisma as never,
    mocks.auditService as never,
    mocks.notificationsService as never
  );

  return { service, mocks };
}

describe('CustomerPortalService google login', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'google-client-id-123';
  });

  it('inicia sesión con Google cuando el token es válido', async () => {
    const { service, mocks } = createServiceWithMocks();

    mocks.prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', name: 'Demo', slug: 'demo' });
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        customer: {
          upsert: jest.fn().mockResolvedValue({ id: 'customer-1' })
        },
        customerAccount: {
          upsert: jest.fn().mockResolvedValue({ id: 'account-1', email: 'customer@example.com' })
        }
      };

      return callback(tx);
    });

    const verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'customer@example.com',
        email_verified: true,
        aud: 'google-client-id-123',
        name: 'Customer Demo'
      })
    });

    (service as unknown as { googleOAuthClient: { verifyIdToken: typeof verifyIdToken } }).googleOAuthClient = {
      verifyIdToken
    };

    const result = await service.loginWithGoogle('demo', { idToken: 'id-token-demo' });

    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe('customer@example.com');
    expect(result.user.scope).toBe('customer');
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-token-demo',
      audience: 'google-client-id-123'
    });
  });

  it('rechaza login cuando Google no valida el token', async () => {
    const { service, mocks } = createServiceWithMocks();

    mocks.prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', name: 'Demo', slug: 'demo' });

    const verifyIdToken = jest.fn().mockRejectedValue(new Error('invalid token'));
    (service as unknown as { googleOAuthClient: { verifyIdToken: typeof verifyIdToken } }).googleOAuthClient = {
      verifyIdToken
    };

    await expect(service.loginWithGoogle('demo', { idToken: 'bad-token' })).rejects.toThrow(
      UnauthorizedException
    );

    expect(mocks.auditService.log).toHaveBeenCalled();
  });
});
