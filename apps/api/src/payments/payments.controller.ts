import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreatePaymentDto } from './dto/create-payment.dto';
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

  @Get()
  list(@Req() req: RequestWithUser, @Query() query: PaymentsQueryDto) {
    return this.paymentsService.list(req.user, query);
  }

  @Get(':id/sale-note')
  saleNote(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.paymentsService.saleNote(req.user, id);
  }
}
