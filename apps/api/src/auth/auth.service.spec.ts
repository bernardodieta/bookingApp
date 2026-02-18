import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

function createServiceWithMocks() {
  const prisma = {
    user: {
      findUnique: jest.fn()
    }
  };

  const service = new AuthService(prisma as never);
  return { service, prisma };
}

describe('AuthService google partner login', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'google-client-id-123';
  });

  it('inicia sesión para partner existente con token Google válido', async () => {
    const { service, prisma } = createServiceWithMocks();

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com'
    });

    const verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'owner@example.com',
        email_verified: true
      })
    });

    (service as unknown as { googleOAuthClient: { verifyIdToken: typeof verifyIdToken } }).googleOAuthClient = {
      verifyIdToken
    };

    const result = await service.loginWithGoogle({ idToken: 'id-token-demo' });

    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe('owner@example.com');
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-token-demo',
      audience: 'google-client-id-123'
    });
  });

  it('rechaza login Google si no existe cuenta de partner', async () => {
    const { service, prisma } = createServiceWithMocks();

    prisma.user.findUnique.mockResolvedValue(null);

    const verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-2',
        email: 'missing@example.com',
        email_verified: true
      })
    });

    (service as unknown as { googleOAuthClient: { verifyIdToken: typeof verifyIdToken } }).googleOAuthClient = {
      verifyIdToken
    };

    await expect(service.loginWithGoogle({ idToken: 'id-token-demo' })).rejects.toThrow(UnauthorizedException);
  });
});
