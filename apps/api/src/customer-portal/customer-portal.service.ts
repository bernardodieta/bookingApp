import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterCustomerAccountDto } from './dto/register-customer-account.dto';
import { LoginCustomerAccountDto } from './dto/login-customer-account.dto';
import { GoogleCustomerLoginDto } from './dto/google-customer-login.dto';
import { CustomerPortalAuthUser } from './customer-portal-auth-user.type';

const ACCESS_EXPIRES_IN = '30d';
const CLAIM_CODE_TTL_MINUTES = 10;

type GoogleTokenInfo = {
  sub?: string;
  email?: string;
  email_verified?: 'true' | 'false';
  aud?: string;
  name?: string;
};

@Injectable()
export class CustomerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService
  ) {}

  private get customerAccountDelegate() {
    return (this.prisma as PrismaService & {
      customerAccount: {
        findUnique: (...args: unknown[]) => Promise<unknown>;
        findFirst: (...args: unknown[]) => Promise<unknown>;
        update: (...args: unknown[]) => Promise<unknown>;
      };
    }).customerAccount;
  }

  private get claimCodeDelegate() {
    return (this.prisma as PrismaService & {
      customerPortalClaimCode: {
        create: (...args: unknown[]) => Promise<unknown>;
        findFirst: (...args: unknown[]) => Promise<unknown>;
      };
    }).customerPortalClaimCode;
  }

  async register(slugOrDomain: string, payload: RegisterCustomerAccountDto) {
    const tenant = await this.findTenantBySlugOrDomain(slugOrDomain);
    const normalizedEmail = payload.email.toLowerCase().trim();

    const accountExists = (await this.customerAccountDelegate.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: normalizedEmail
        }
      }
    })) as { passwordHash: string | null } | null;

    if (accountExists?.passwordHash) {
      await this.auditPortalEvent({
        tenantId: tenant.id,
        action: 'CUSTOMER_PORTAL_REGISTER_FAILED',
        metadata: {
          reason: 'ACCOUNT_EXISTS',
          email: normalizedEmail
        } as Prisma.InputJsonValue
      });
      throw new BadRequestException('Ya existe una cuenta para este correo.');
    }

    const fullName = payload.fullName?.trim() || normalizedEmail.split('@')[0];

    const account = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email: normalizedEmail
          }
        },
        update: {
          fullName
        },
        create: {
          tenantId: tenant.id,
          email: normalizedEmail,
          fullName
        }
      });

      try {
        return await (tx as Prisma.TransactionClient & {
          customerAccount: {
            upsert: (...args: unknown[]) => Promise<unknown>;
          };
        }).customerAccount.upsert({
          where: {
            tenantId_email: {
              tenantId: tenant.id,
              email: normalizedEmail
            }
          },
          update: {
            customerId: customer.id,
            isActive: true,
            passwordHash: this.hashPassword(payload.password),
            lastLoginAt: new Date()
          },
          create: {
            tenantId: tenant.id,
            customerId: customer.id,
            email: normalizedEmail,
            passwordHash: this.hashPassword(payload.password),
            isActive: true,
            lastLoginAt: new Date()
          }
        }) as {
          id: string;
          email: string;
        };
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          throw new BadRequestException('No se pudo vincular la cuenta del cliente.');
        }
        throw error;
      }
    });

    await this.auditPortalEvent({
      tenantId: tenant.id,
      action: 'CUSTOMER_PORTAL_REGISTERED',
      entityId: account.id,
      metadata: {
        method: 'password',
        email: account.email
      } as Prisma.InputJsonValue
    });

    return this.issueToken({
      sub: account.id,
      tenantId: tenant.id,
      email: account.email,
      scope: 'customer'
    });
  }

  async login(slugOrDomain: string, payload: LoginCustomerAccountDto) {
    const tenant = await this.findTenantBySlugOrDomain(slugOrDomain);
    const normalizedEmail = payload.email.toLowerCase().trim();

    const account = (await this.customerAccountDelegate.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: normalizedEmail
        }
      }
    })) as {
      id: string;
      tenantId: string;
      email: string;
      passwordHash: string | null;
      isActive: boolean;
    } | null;

    if (!account || !account.passwordHash || account.passwordHash !== this.hashPassword(payload.password)) {
      await this.auditPortalEvent({
        tenantId: tenant.id,
        action: 'CUSTOMER_PORTAL_LOGIN_FAILED',
        metadata: {
          reason: 'INVALID_CREDENTIALS',
          email: normalizedEmail
        } as Prisma.InputJsonValue
      });
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (!account.isActive) {
      await this.auditPortalEvent({
        tenantId: tenant.id,
        action: 'CUSTOMER_PORTAL_LOGIN_FAILED',
        entityId: account.id,
        metadata: {
          reason: 'INACTIVE_ACCOUNT',
          email: normalizedEmail
        } as Prisma.InputJsonValue
      });
      throw new UnauthorizedException('Cuenta inactiva.');
    }

    await this.customerAccountDelegate.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() }
    });

    await this.auditPortalEvent({
      tenantId: tenant.id,
      action: 'CUSTOMER_PORTAL_LOGIN_SUCCESS',
      entityId: account.id,
      metadata: {
        method: 'password',
        email: account.email
      } as Prisma.InputJsonValue
    });

    return this.issueToken({
      sub: account.id,
      tenantId: tenant.id,
      email: account.email,
      scope: 'customer'
    });
  }

  async loginWithGoogle(slugOrDomain: string, payload: GoogleCustomerLoginDto) {
    const tenant = await this.findTenantBySlugOrDomain(slugOrDomain);

    let tokenInfo: GoogleTokenInfo;
    try {
      tokenInfo = await this.verifyGoogleIdToken(payload.idToken);
    } catch (error) {
      await this.auditPortalEvent({
        tenantId: tenant.id,
        action: 'CUSTOMER_PORTAL_GOOGLE_LOGIN_FAILED',
        metadata: {
          reason: 'TOKEN_VALIDATION_FAILED'
        } as Prisma.InputJsonValue
      });
      throw error;
    }

    const email = tokenInfo.email?.toLowerCase().trim();
    const sub = tokenInfo.sub?.trim();

    if (!email || !sub) {
      await this.auditPortalEvent({
        tenantId: tenant.id,
        action: 'CUSTOMER_PORTAL_GOOGLE_LOGIN_FAILED',
        metadata: {
          reason: 'MISSING_EMAIL_OR_SUB'
        } as Prisma.InputJsonValue
      });
      throw new UnauthorizedException('No se pudo validar la identidad de Google.');
    }

    if (tokenInfo.email_verified !== 'true') {
      await this.auditPortalEvent({
        tenantId: tenant.id,
        action: 'CUSTOMER_PORTAL_GOOGLE_LOGIN_FAILED',
        metadata: {
          reason: 'EMAIL_NOT_VERIFIED',
          email
        } as Prisma.InputJsonValue
      });
      throw new UnauthorizedException('Google no confirmó el email.');
    }

    const fullName = tokenInfo.name?.trim() || email.split('@')[0];

    const account = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email
          }
        },
        update: {
          fullName
        },
        create: {
          tenantId: tenant.id,
          fullName,
          email
        }
      });

      return (await (tx as Prisma.TransactionClient & {
        customerAccount: {
          upsert: (...args: unknown[]) => Promise<unknown>;
        };
      }).customerAccount.upsert({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email
          }
        },
        update: {
          customerId: customer.id,
          googleSub: sub,
          isActive: true,
          lastLoginAt: new Date()
        },
        create: {
          tenantId: tenant.id,
          customerId: customer.id,
          email,
          googleSub: sub,
          isActive: true,
          lastLoginAt: new Date()
        }
      })) as {
        id: string;
        email: string;
      };
    });

    await this.auditPortalEvent({
      tenantId: tenant.id,
      action: 'CUSTOMER_PORTAL_LOGIN_SUCCESS',
      entityId: account.id,
      metadata: {
        method: 'google',
        email: account.email
      } as Prisma.InputJsonValue
    });

    return this.issueToken({
      sub: account.id,
      tenantId: tenant.id,
      email: account.email,
      scope: 'customer'
    });
  }

  async getMe(user: CustomerPortalAuthUser) {
    const account = (await this.customerAccountDelegate.findFirst({
      where: {
        id: user.sub,
        tenantId: user.tenantId,
        isActive: true
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        }
      }
    })) as {
      id: string;
      email: string;
      lastLoginAt: Date | null;
      customer: {
        id: string;
        fullName: string;
        email: string;
        phone: string | null;
      } | null;
    } | null;

    if (!account) {
      throw new UnauthorizedException('Sesión de cliente inválida.');
    }

    return {
      id: account.id,
      email: account.email,
      customer: account.customer,
      lastLoginAt: account.lastLoginAt
    };
  }

  async listMyBookings(user: CustomerPortalAuthUser) {
    const account = (await this.customerAccountDelegate.findFirst({
      where: {
        id: user.sub,
        tenantId: user.tenantId,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        customerId: true
      }
    })) as {
      id: string;
      email: string;
      customerId: string | null;
    } | null;

    if (!account) {
      throw new UnauthorizedException('Sesión de cliente inválida.');
    }

    const bookingIdentityFilters: Prisma.BookingWhereInput[] = [{ customerEmail: account.email }];
    if (account.customerId) {
      bookingIdentityFilters.push({ customerId: account.customerId });
    }

    return this.prisma.booking.findMany({
      where: {
        tenantId: user.tenantId,
        OR: bookingIdentityFilters
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            durationMinutes: true
          }
        },
        staff: {
          select: {
            id: true,
            fullName: true
          }
        }
      },
      orderBy: {
        startAt: 'desc'
      }
    });
  }

  async requestClaimCode(user: CustomerPortalAuthUser) {
    const account = await this.requireActiveAccount(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true }
    });

    const code = this.generateVerificationCode();
    const codeHash = this.hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + CLAIM_CODE_TTL_MINUTES * 60_000);

    await this.claimCodeDelegate.create({
      data: {
        tenantId: user.tenantId,
        accountId: account.id,
        codeHash,
        expiresAt
      }
    });

    await this.notificationsService.sendCustomerPortalClaimCodeEmail({
      tenantName: tenant?.name ?? 'Apoint',
      customerEmail: account.email,
      code,
      expiresInMinutes: CLAIM_CODE_TTL_MINUTES
    });

    await this.auditPortalEvent({
      tenantId: user.tenantId,
      action: 'CUSTOMER_PORTAL_CLAIM_REQUESTED',
      entityId: account.id,
      metadata: {
        email: account.email,
        expiresAt: expiresAt.toISOString()
      } as Prisma.InputJsonValue
    });

    return {
      requested: true,
      expiresInMinutes: CLAIM_CODE_TTL_MINUTES
    };
  }

  async confirmClaimCode(user: CustomerPortalAuthUser, code: string) {
    const account = await this.requireActiveAccount(user);
    const normalizedCode = code.trim();

    const claim = (await this.claimCodeDelegate.findFirst({
      where: {
        tenantId: user.tenantId,
        accountId: account.id,
        consumedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    })) as {
      id: string;
      codeHash: string;
      expiresAt: Date;
    } | null;

    if (!claim) {
      throw new BadRequestException('No hay código de verificación activo.');
    }

    if (claim.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('El código de verificación expiró.');
    }

    if (claim.codeHash !== this.hashVerificationCode(normalizedCode)) {
      await this.auditPortalEvent({
        tenantId: user.tenantId,
        action: 'CUSTOMER_PORTAL_CLAIM_FAILED',
        entityId: account.id,
        metadata: {
          reason: 'INVALID_CODE'
        } as Prisma.InputJsonValue
      });
      throw new BadRequestException('Código inválido.');
    }

    const customer = await this.prisma.customer.upsert({
      where: {
        tenantId_email: {
          tenantId: user.tenantId,
          email: account.email
        }
      },
      update: {},
      create: {
        tenantId: user.tenantId,
        email: account.email,
        fullName: account.email.split('@')[0]
      }
    });

    const result = await this.prisma.$transaction(async (tx) => {
      await (tx as Prisma.TransactionClient & {
        customerPortalClaimCode: {
          update: (...args: unknown[]) => Promise<unknown>;
        };
      }).customerPortalClaimCode.update({
        where: { id: claim.id },
        data: { consumedAt: new Date() }
      });

      await (tx as Prisma.TransactionClient & {
        customerAccount: {
          update: (...args: unknown[]) => Promise<unknown>;
        };
      }).customerAccount.update({
        where: { id: account.id },
        data: {
          customerId: customer.id
        }
      });

      const bookingUpdate = await tx.booking.updateMany({
        where: {
          tenantId: user.tenantId,
          customerEmail: account.email,
          customerId: null
        },
        data: {
          customerId: customer.id
        }
      });

      return {
        linkedBookings: bookingUpdate.count
      };
    });

    await this.auditPortalEvent({
      tenantId: user.tenantId,
      action: 'CUSTOMER_PORTAL_CLAIM_CONFIRMED',
      entityId: account.id,
      metadata: {
        customerId: customer.id,
        linkedBookings: result.linkedBookings
      } as Prisma.InputJsonValue
    });

    return {
      claimed: true,
      customerId: customer.id,
      linkedBookings: result.linkedBookings
    };
  }

  verifyCustomerAccessToken(token: string): CustomerPortalAuthUser {
    try {
      const decoded = jwt.verify(token, this.getAccessSecret()) as CustomerPortalAuthUser;
      if (decoded.scope !== 'customer') {
        throw new UnauthorizedException('Token inválido.');
      }

      return {
        sub: decoded.sub,
        tenantId: decoded.tenantId,
        email: decoded.email,
        scope: 'customer'
      };
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  private async findTenantBySlugOrDomain(slugOrDomain: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ slug: slugOrDomain }, { customDomain: slugOrDomain.toLowerCase() }]
      },
      select: {
        id: true
      }
    });

    if (!tenant) {
      throw new NotFoundException('Negocio no encontrado.');
    }

    return tenant;
  }

  private issueToken(user: CustomerPortalAuthUser) {
    const accessToken = jwt.sign(user, this.getAccessSecret(), { expiresIn: ACCESS_EXPIRES_IN });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_EXPIRES_IN,
      user
    };
  }

  private hashPassword(password: string) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private getAccessSecret() {
    return process.env.JWT_CUSTOMER_SECRET ?? process.env.JWT_ACCESS_SECRET ?? 'dev_customer_secret';
  }

  private async verifyGoogleIdToken(idToken: string) {
    const url = new URL('https://oauth2.googleapis.com/tokeninfo');
    url.searchParams.set('id_token', idToken);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new UnauthorizedException('No se pudo validar token de Google.');
    }

    const payload = (await response.json()) as GoogleTokenInfo;
    const requiredAudience = process.env.GOOGLE_CLIENT_ID?.trim();
    if (requiredAudience && payload.aud && payload.aud !== requiredAudience) {
      throw new UnauthorizedException('Token de Google para cliente inválido.');
    }

    if (requiredAudience && !payload.aud) {
      throw new UnauthorizedException('Token de Google incompleto.');
    }

    return payload;
  }

  private isUniqueConstraintError(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';
  }

  private async requireActiveAccount(user: CustomerPortalAuthUser) {
    const account = (await this.customerAccountDelegate.findFirst({
      where: {
        id: user.sub,
        tenantId: user.tenantId,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        customerId: true
      }
    })) as {
      id: string;
      email: string;
      customerId: string | null;
    } | null;

    if (!account) {
      throw new UnauthorizedException('Sesión de cliente inválida.');
    }

    return account;
  }

  private generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private hashVerificationCode(code: string) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private async auditPortalEvent(input: {
    tenantId: string;
    action: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    try {
      await this.auditService.log({
        tenantId: input.tenantId,
        action: input.action,
        entity: 'customer_portal',
        entityId: input.entityId,
        metadata: input.metadata
      });
    } catch {
      // no-op: auditoría no debe romper flujo de auth de cliente
    }
  }
}
