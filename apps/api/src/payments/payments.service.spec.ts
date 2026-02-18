import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

function createService() {
  const prisma = {};
  const auditService = {
    log: jest.fn()
  };

  const service = new PaymentsService(prisma as never, auditService as never);
  return { service };
}

describe('PaymentsService Stripe webhook', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  it('rechaza webhook sin Stripe-Signature', async () => {
    const { service } = createService();

    (service as unknown as { stripeClient: { webhooks: { constructEvent: jest.Mock } } }).stripeClient = {
      webhooks: { constructEvent: jest.fn() }
    };

    await expect(service.handleStripeWebhook({ rawBody: Buffer.from('{}') })).rejects.toThrow(BadRequestException);
  });

  it('ignora eventos no soportados', async () => {
    const { service } = createService();

    const constructEvent = jest.fn().mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: {} }
    });

    (service as unknown as { stripeClient: { webhooks: { constructEvent: typeof constructEvent } } }).stripeClient = {
      webhooks: { constructEvent }
    };

    const result = await service.handleStripeWebhook({
      signature: 'test-signature',
      rawBody: Buffer.from('{"id":"evt_1"}')
    });

    expect(result).toEqual({
      received: true,
      handled: false,
      eventType: 'payment_intent.succeeded'
    });
  });

  it('procesa checkout.session.completed firmado', async () => {
    const { service } = createService();

    const session = {
      id: 'cs_test_123',
      metadata: {
        tenantId: 'tenant-1',
        bookingId: 'booking-1',
        mode: 'full'
      }
    };

    const constructEvent = jest.fn().mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: session }
    });

    (service as unknown as { stripeClient: { webhooks: { constructEvent: typeof constructEvent } } }).stripeClient = {
      webhooks: { constructEvent }
    };

    const recordSpy = jest
      .spyOn(service as unknown as { recordStripePaidSession: (input: unknown) => Promise<unknown> }, 'recordStripePaidSession')
      .mockResolvedValue({ alreadyConfirmed: false });

    const result = await service.handleStripeWebhook({
      signature: 'test-signature',
      rawBody: Buffer.from('{"id":"evt_2"}')
    });

    expect(recordSpy).toHaveBeenCalledWith({
      session,
      source: 'webhook'
    });
    expect(result).toEqual({
      received: true,
      handled: true,
      eventType: 'checkout.session.completed',
      sessionId: 'cs_test_123'
    });
  });
});
