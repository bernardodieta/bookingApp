import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';

const ACCESS_EXPIRES_IN = '2h';

type GoogleTokenInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleOAuthClient = new OAuth2Client();

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

    return this.issueTokens({ sub: created.user.id, tenantId: created.tenant.id, email: normalizedEmail, role: 'owner' });
  }

  async login(payload: LoginDto) {
    const normalizedEmail = payload.email.toLowerCase();
    this.logger.log(`[login] Attempt for email=${normalizedEmail}`);

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || user.passwordHash !== this.hashPassword(payload.password)) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    this.logger.log(`[login] User found id=${user.id} role=${user.role} tenantId=${user.tenantId}`);

    const staffRecord = await this.findLinkedStaff(user.id);

    return this.issueTokens({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role as AuthUser['role'],
      ...(staffRecord ? { staffId: staffRecord.id } : {}),
    });
  }

  async loginWithGoogle(payload: GoogleLoginDto) {
    const tokenInfo = await this.verifyGoogleIdToken(payload.idToken);
    const normalizedEmail = tokenInfo.email?.toLowerCase().trim();

    if (!normalizedEmail || !tokenInfo.sub?.trim()) {
      throw new UnauthorizedException('No se pudo validar la identidad de Google.');
    }

    const isEmailVerified = tokenInfo.email_verified === true;
    if (!isEmailVerified) {
      throw new UnauthorizedException('Google no confirmó el email.');
    }

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      throw new UnauthorizedException('No existe una cuenta de partner para este correo.');
    }

    const staffRecord = await this.findLinkedStaff(user.id);

    return this.issueTokens({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role as AuthUser['role'],
      ...(staffRecord ? { staffId: staffRecord.id } : {}),
    });
  }

  verifyAccessToken(token: string): AuthUser {
    try {
      const decoded = jwt.verify(token, this.getAccessSecret()) as AuthUser;
      return {
        sub: decoded.sub,
        tenantId: decoded.tenantId,
        email: decoded.email,
        role: decoded.role ?? 'owner',
        ...(decoded.staffId ? { staffId: decoded.staffId } : {}),
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

  async registerStaff(payload: { tenantSlug: string; email: string; password: string }) {
    const normalizedEmail = payload.email.toLowerCase().trim();

    const tenant = await this.prisma.tenant.findUnique({ where: { slug: payload.tenantSlug } });
    if (!tenant) {
      throw new BadRequestException('No se encontró el negocio con ese identificador.');
    }

    const staffRecord = await this.prisma.staff.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: normalizedEmail } },
    });
    if (!staffRecord || !staffRecord.active) {
      throw new BadRequestException('No existe un miembro de staff con ese email en este negocio.');
    }
    if (staffRecord.userId) {
      throw new BadRequestException('Este miembro de staff ya tiene una cuenta registrada.');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      throw new BadRequestException('El correo ya está registrado.');
    }

    const passwordHash = this.hashPassword(payload.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          passwordHash,
          role: 'staff',
        },
      });

      await tx.staff.update({
        where: { id: staffRecord.id },
        data: { userId: newUser.id },
      });

      return newUser;
    });

    return this.issueTokens({
      sub: user.id,
      tenantId: tenant.id,
      email: normalizedEmail,
      role: 'staff',
      staffId: staffRecord.id,
    });
  }

  private async findLinkedStaff(userId: string) {
    try {
      return await this.prisma.staff.findUnique({ where: { userId } });
    } catch (err) {
      this.logger.warn(`[findLinkedStaff] Failed for userId=${userId}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
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

  private async verifyGoogleIdToken(idToken: string) {
    const requiredAudience = process.env.GOOGLE_CLIENT_ID?.trim();
    let payload: TokenPayload | undefined;

    try {
      const ticket = await this.googleOAuthClient.verifyIdToken({
        idToken,
        audience: requiredAudience || undefined
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('No se pudo validar token de Google.');
    }

    if (!payload) {
      throw new UnauthorizedException('Token de Google incompleto.');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified
    } satisfies GoogleTokenInfo;
  }
}
