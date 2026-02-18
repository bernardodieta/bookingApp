import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { AuthUser } from '../common/types/auth-user.type';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateStripeCheckoutDto } from './dto/create-stripe-checkout.dto';
import { ConfirmStripeSessionDto } from './dto/confirm-stripe-session.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';

@Injectable()
export class PaymentsService {
  private stripeClient: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async create(user: AuthUser, payload: CreatePaymentDto) {
    const context = await this.resolveBookingPaymentContext(user, payload.bookingId, payload.mode, payload.amount);

    const payment = await this.prisma.payment.create({
      data: {
        tenantId: user.tenantId,
        bookingId: context.booking.id,
        customerId: context.booking.customerId,
        kind: payload.mode,
        status: PaymentStatus.paid,
        method: payload.method ?? PaymentMethod.cash,
        provider: 'manual',
        amount: context.amount,
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

    const newNetPaid = context.netPaid + context.amount;

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'PAYMENT_RECORDED',
      entity: 'payment',
      entityId: payment.id,
      metadata: {
        bookingId: payment.bookingId,
        mode: payload.mode,
        amount: context.amount,
        outstandingAfter: Math.max(context.servicePrice - newNetPaid, 0)
      } as Prisma.InputJsonValue
    });

    return {
      payment,
      summary: {
        servicePrice: context.servicePrice,
        paid: newNetPaid,
        outstanding: Math.max(context.servicePrice - newNetPaid, 0)
      }
    };
  }

  async createStripeCheckoutSession(user: AuthUser, payload: CreateStripeCheckoutDto) {
    const stripe = this.getStripeClient();
    const context = await this.resolveBookingPaymentContext(user, payload.bookingId, payload.mode, payload.amount);
    const webUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.WEB_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: payload.successUrl ?? `${webUrl}/dashboard?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: payload.cancelUrl ?? `${webUrl}/dashboard?stripe=cancelled`,
      customer_email: context.booking.customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'mxn',
            unit_amount: Math.round(context.amount * 100),
            product_data: {
              name: `${context.booking.service.name} (${payload.mode === 'full' ? 'Pago total' : 'Depósito'})`
            }
          }
        }
      ],
      metadata: {
        tenantId: user.tenantId,
        bookingId: context.booking.id,
        mode: payload.mode
      }
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'PAYMENT_STRIPE_SESSION_CREATED',
      entity: 'booking',
      entityId: context.booking.id,
      metadata: {
        mode: payload.mode,
        amount: context.amount,
        sessionId: session.id
      } as Prisma.InputJsonValue
    });

    return {
      sessionId: session.id,
      url: session.url,
      amount: context.amount,
      currency: 'MXN'
    };
  }

  async confirmStripeSession(user: AuthUser, payload: ConfirmStripeSessionDto) {
    const stripe = this.getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(payload.sessionId);

    if (session.payment_status !== 'paid') {
      throw new BadRequestException('La sesión de Stripe aún no está pagada.');
    }

    const tenantId = session.metadata?.tenantId;
    const bookingId = session.metadata?.bookingId;
    const mode = session.metadata?.mode;

    if (!tenantId || !bookingId || !mode) {
      throw new BadRequestException('La sesión de Stripe no tiene metadata suficiente.');
    }

    if (tenantId !== user.tenantId) {
      throw new NotFoundException('Sesión de Stripe no encontrada para este tenant.');
    }

    if (mode !== 'full' && mode !== 'deposit') {
      throw new BadRequestException('Modo de pago inválido en sesión de Stripe.');
    }

    const existing = await this.prisma.payment.findFirst({
      where: {
        tenantId: user.tenantId,
        provider: 'stripe',
        providerReference: session.id
      },
      select: { id: true }
    });

    if (existing) {
      return {
        alreadyConfirmed: true,
        paymentId: existing.id
      };
    }

    const amount = Number((session.amount_total ?? 0) / 100);
    const context = await this.resolveBookingPaymentContext(user, bookingId, mode, amount);

    const payment = await this.prisma.payment.create({
      data: {
        tenantId: user.tenantId,
        bookingId: context.booking.id,
        customerId: context.booking.customerId,
        kind: mode,
        status: PaymentStatus.paid,
        method: PaymentMethod.stripe,
        provider: 'stripe',
        providerReference: session.id,
        amount: context.amount,
        currency: String(session.currency ?? 'mxn').toUpperCase(),
        paidAt: new Date()
      }
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      actorUserId: user.sub,
      action: 'PAYMENT_STRIPE_CONFIRMED',
      entity: 'payment',
      entityId: payment.id,
      metadata: {
        sessionId: session.id,
        bookingId: context.booking.id,
        amount: context.amount,
        mode
      } as Prisma.InputJsonValue
    });

    return {
      alreadyConfirmed: false,
      paymentId: payment.id,
      amount: context.amount,
      currency: payment.currency
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

  private async resolveBookingPaymentContext(
    user: AuthUser,
    bookingId: string,
    mode: 'full' | 'deposit',
    requestedAmount?: number
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, tenantId: user.tenantId },
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
    if (mode === 'full') {
      amount = outstanding;
    } else {
      if (typeof requestedAmount !== 'number' || Number.isNaN(requestedAmount)) {
        throw new BadRequestException('Para depósito debes indicar amount.');
      }
      amount = requestedAmount;
    }

    if (amount <= 0) {
      throw new BadRequestException('La reserva ya está pagada por completo.');
    }

    if (amount > outstanding) {
      throw new BadRequestException('El monto excede el saldo pendiente de la reserva.');
    }

    return {
      booking,
      servicePrice,
      netPaid,
      outstanding,
      amount
    };
  }

  private getStripeClient() {
    if (this.stripeClient) {
      return this.stripeClient;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BadRequestException('STRIPE_SECRET_KEY no configurada.');
    }

    this.stripeClient = new Stripe(secretKey, {
      apiVersion: '2024-06-20'
    });

    return this.stripeClient;
  }
}
