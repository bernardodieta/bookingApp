import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async create(user: AuthUser, payload: CreatePaymentDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: payload.bookingId, tenantId: user.tenantId },
      include: {
        service: {
          select: {
            name: true,
            price: true
          }
        },
        payments: {
          where: {
            status: PaymentStatus.paid
          },
          select: {
            kind: true,
            amount: true
          }
        }
      }
    });

    if (!booking) {
      throw new NotFoundException('Booking no encontrado.');
    }

    const servicePrice = Number(booking.service.price);
    const netPaid = booking.payments.reduce((acc, payment) => {
      const amount = Number(payment.amount);
      if (payment.kind === 'refund') {
        return acc - amount;
      }
      return acc + amount;
    }, 0);

    const outstanding = Math.max(servicePrice - netPaid, 0);

    let amount = 0;
    if (payload.mode === 'full') {
      amount = outstanding;
    } else {
      if (typeof payload.amount !== 'number' || Number.isNaN(payload.amount)) {
        throw new BadRequestException('Para depósito debes indicar amount.');
      }
      amount = payload.amount;
    }

    if (amount <= 0) {
      throw new BadRequestException('La reserva ya está pagada por completo.');
    }

    if (amount > outstanding) {
      throw new BadRequestException('El monto excede el saldo pendiente de la reserva.');
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId: user.tenantId,
        bookingId: booking.id,
        customerId: booking.customerId,
        kind: payload.mode,
        status: PaymentStatus.paid,
        method: payload.method ?? PaymentMethod.cash,
        provider: 'manual',
        amount,
        currency: 'MXN',
        notes: payload.notes,
        paidAt: new Date()
      },
      include: {
        booking: {
          include: {
            service: {
              select: { name: true }
            },
            staff: {
              select: { fullName: true }
            }
          }
        }
      }
    });

    const newNetPaid = netPaid + amount;

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'PAYMENT_RECORDED',
      entity: 'payment',
      entityId: payment.id,
      metadata: {
        bookingId: payment.bookingId,
        mode: payload.mode,
        amount,
        outstandingAfter: Math.max(servicePrice - newNetPaid, 0)
      } as Prisma.InputJsonValue
    });

    return {
      payment,
      summary: {
        servicePrice,
        paid: newNetPaid,
        outstanding: Math.max(servicePrice - newNetPaid, 0)
      }
    };
  }

  async list(user: AuthUser, query: PaymentsQueryDto) {
    return this.prisma.payment.findMany({
      where: {
        tenantId: user.tenantId,
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.bookingId ? { bookingId: query.bookingId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.kind ? { kind: query.kind } : {})
      },
      include: {
        booking: {
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
            startAt: true,
            service: {
              select: {
                id: true,
                name: true,
                price: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async saleNote(user: AuthUser, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId: user.tenantId
      },
      include: {
        tenant: {
          select: {
            name: true,
            slug: true
          }
        },
        booking: {
          include: {
            service: {
              select: {
                name: true,
                price: true
              }
            },
            staff: {
              select: {
                fullName: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado.');
    }

    return {
      folio: `NV-${new Date(payment.createdAt).toISOString().slice(0, 10).replace(/-/g, '')}-${payment.id.slice(-6)}`,
      issuedAt: payment.createdAt.toISOString(),
      tenant: payment.tenant,
      payment: {
        id: payment.id,
        kind: payment.kind,
        status: payment.status,
        method: payment.method,
        amount: Number(payment.amount),
        currency: payment.currency,
        notes: payment.notes
      },
      booking: {
        id: payment.booking.id,
        customerName: payment.booking.customerName,
        customerEmail: payment.booking.customerEmail,
        startAt: payment.booking.startAt,
        serviceName: payment.booking.service.name,
        servicePrice: Number(payment.booking.service.price),
        staffName: payment.booking.staff.fullName
      }
    };
  }
}
