import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCreateTenantDto } from './dto/admin-create-tenant.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        customDomain: true,
        widgetEnabled: true,
        locale: true,
        timeZone: true,
        createdAt: true,
        _count: {
          select: {
            bookings: true,
            staff: true,
            services: true,
            customers: true
          }
        },
        users: {
          select: { email: true, role: true },
          where: { role: 'owner' },
          take: 1
        }
      }
    });

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      customDomain: t.customDomain,
      widgetEnabled: t.widgetEnabled,
      locale: t.locale,
      timeZone: t.timeZone,
      ownerEmail: t.users[0]?.email ?? null,
      bookingsCount: t._count.bookings,
      staffCount: t._count.staff,
      servicesCount: t._count.services,
      customersCount: t._count.customers,
      createdAt: t.createdAt
    }));
  }

  async createTenant(payload: AdminCreateTenantDto) {
    const normalizedEmail = payload.ownerEmail.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new BadRequestException('El correo ya está registrado.');
    }

    const tenantName = payload.tenantName.trim();
    const baseSlug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tenant';
    const slug = await this.makeUniqueSlug(baseSlug);

    const passwordHash = this.hashPassword(payload.ownerPassword);
    const plan: Plan = payload.plan ?? 'free';

    let customDomain: string | undefined;
    if (payload.customDomain) {
      customDomain = payload.customDomain.toLowerCase().trim().replace(/^https?:\/\//, '');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: tenantName, slug, plan, customDomain }
      });
      const user = await tx.user.create({
        data: { tenantId: tenant.id, email: normalizedEmail, passwordHash, role: 'owner' }
      });
      return { tenant, user };
    });

    return {
      id: created.tenant.id,
      name: created.tenant.name,
      slug: created.tenant.slug,
      plan: created.tenant.plan,
      customDomain: created.tenant.customDomain,
      ownerEmail: created.user.email,
      dashboardUrl: `/login`,
      publicUrl: `/public/${created.tenant.slug}`
    };
  }

  async changePlan(tenantId: string, plan: Plan) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado.');
    }
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan },
      select: { id: true, name: true, slug: true, plan: true }
    });
    return updated;
  }

  async deleteTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado.');
    }
    await this.prisma.tenant.delete({ where: { id: tenantId } });
    return { deleted: true, name: tenant.name };
  }

  private hashPassword(password: string) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private async makeUniqueSlug(baseSlug: string, attempt = 0): Promise<string> {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    const exists = await this.prisma.tenant.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    return this.makeUniqueSlug(baseSlug, attempt + 1);
  }
}
