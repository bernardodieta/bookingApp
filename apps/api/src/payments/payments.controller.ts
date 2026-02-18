import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateStripeCheckoutDto } from './dto/create-stripe-checkout.dto';
import { ConfirmStripeSessionDto } from './dto/confirm-stripe-session.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { PaymentsService } from './payments.service';

type RequestWithUser = Request & { user: AuthUser };

@Controller('payments')
@UseGuards(AuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Req() req: RequestWithUser, @Body() body: CreatePaymentDto) {
    return this.paymentsService.create(req.user, body);
  }

  @Post('stripe/checkout-session')
  createStripeCheckoutSession(@Req() req: RequestWithUser, @Body() body: CreateStripeCheckoutDto) {
    return this.paymentsService.createStripeCheckoutSession(req.user, body);
  }

  @Post('stripe/confirm')
  confirmStripeSession(@Req() req: RequestWithUser, @Body() body: ConfirmStripeSessionDto) {
    return this.paymentsService.confirmStripeSession(req.user, body);
  }

  @Get()
  list(@Req() req: RequestWithUser, @Query() query: PaymentsQueryDto) {
    return this.paymentsService.list(req.user, query);
  }

  @Get(':id/sale-note')
  saleNote(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.paymentsService.saleNote(req.user, id);
  }
}
