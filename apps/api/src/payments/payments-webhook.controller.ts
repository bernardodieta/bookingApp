import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';

type StripeWebhookRequest = Request & { rawBody?: Buffer };

@Controller('payments/stripe')
export class PaymentsWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @HttpCode(200)
  handleStripeWebhook(@Req() req: StripeWebhookRequest, @Headers('stripe-signature') signature?: string) {
    if (!req.rawBody) {
      throw new BadRequestException('No se recibió rawBody para validar webhook de Stripe.');
    }

    return this.paymentsService.handleStripeWebhook({
      signature,
      rawBody: req.rawBody
    });
  }
}
