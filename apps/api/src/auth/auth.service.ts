import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';

const ACCESS_EXPIRES_IN = '2h';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(payload: RegisterDto) {
    const normalizedEmail = payload.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new BadRequestException('El correo ya está registrado.');
    }

    const tenantName = payload.tenantName.trim();
    const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const passwordHash = this.hashPassword(payload.password);
    const created = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug: await this.makeUniqueSlug(tx, slug || 'tenant')
        }
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          passwordHash,
          role: 'owner'
        }
      });

      return { tenant, user };
    });

    return this.issueTokens({ sub: created.user.id, tenantId: created.tenant.id, email: normalizedEmail });
  }

  async login(payload: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: payload.email.toLowerCase() } });

    if (!user || user.passwordHash !== this.hashPassword(payload.password)) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    return this.issueTokens({ sub: user.id, tenantId: user.tenantId, email: user.email });
  }

  verifyAccessToken(token: string): AuthUser {
    try {
      const decoded = jwt.verify(token, this.getAccessSecret()) as AuthUser;
      return {
        sub: decoded.sub,
        tenantId: decoded.tenantId,
        email: decoded.email
      };
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  private issueTokens(user: AuthUser) {
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

  private async makeUniqueSlug(
    tx: Pick<PrismaService, 'tenant'>,
    baseSlug: string,
    attempt = 0
  ): Promise<string> {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    const exists = await tx.tenant.findUnique({ where: { slug: candidate } });
    if (!exists) {
      return candidate;
    }
    return this.makeUniqueSlug(tx, baseSlug, attempt + 1);
  }

  private getAccessSecret() {
    return process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret';
  }
}
