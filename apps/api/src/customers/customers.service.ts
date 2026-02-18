import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersQueryDto } from './dto/customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(user: AuthUser, query: CustomersQueryDto) {
    const search = query.search?.trim();

    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId: user.tenantId,
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      include: {
        _count: {
          select: {
            bookings: true
          }
        },
        bookings: {
          orderBy: { startAt: 'desc' },
          take: 1,
          select: {
            id: true,
            startAt: true,
            status: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return customers.map((customer) => ({
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      internalNotes: customer.internalNotes,
      totalBookings: customer._count.bookings,
      lastBooking: customer.bookings[0] ?? null,
      updatedAt: customer.updatedAt
    }));
  }

  async getById(user: AuthUser, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      include: {
        bookings: {
          include: {
            service: true,
            staff: true
          },
          orderBy: { startAt: 'desc' }
        }
      }
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    return customer;
  }

  async update(user: AuthUser, customerId: string, payload: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true }
    });

    if (!existing) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    const data: Prisma.CustomerUpdateInput = {
      fullName: payload.fullName,
      phone: payload.phone,
      internalNotes: payload.internalNotes,
      metadata: payload.metadata as Prisma.InputJsonValue | undefined
    };

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'CUSTOMER_UPDATED',
      entity: 'customer',
      entityId: customerId,
      metadata: Object.keys(payload) as unknown as Prisma.InputJsonValue
    });

    return updated;
  }
}
