import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CustomerPortalService } from './customer-portal.service';
import { RegisterCustomerAccountDto } from './dto/register-customer-account.dto';
import { LoginCustomerAccountDto } from './dto/login-customer-account.dto';
import { GoogleCustomerLoginDto } from './dto/google-customer-login.dto';
import { CustomerPortalAuthGuard } from './customer-portal-auth.guard';
import { CustomerPortalAuthUser } from './customer-portal-auth-user.type';
import { ConfirmClaimCodeDto } from './dto/confirm-claim-code.dto';

type RequestWithCustomerUser = Request & { customerUser: CustomerPortalAuthUser };

@Controller('public/:slugOrDomain/customer-portal')
export class CustomerPortalController {
  constructor(private readonly customerPortalService: CustomerPortalService) {}

  @Post('register')
  register(
    @Param('slugOrDomain') slugOrDomain: string,
    @Body() body: RegisterCustomerAccountDto
  ) {
    return this.customerPortalService.register(slugOrDomain, body);
  }

  @Post('login')
  login(
    @Param('slugOrDomain') slugOrDomain: string,
    @Body() body: LoginCustomerAccountDto
  ) {
    return this.customerPortalService.login(slugOrDomain, body);
  }

  @Post('google')
  loginWithGoogle(
    @Param('slugOrDomain') slugOrDomain: string,
    @Body() body: GoogleCustomerLoginDto
  ) {
    return this.customerPortalService.loginWithGoogle(slugOrDomain, body);
  }

  @Get('me')
  @UseGuards(CustomerPortalAuthGuard)
  me(@Req() req: RequestWithCustomerUser) {
    return this.customerPortalService.getMe(req.customerUser);
  }

  @Get('bookings')
  @UseGuards(CustomerPortalAuthGuard)
  bookings(@Req() req: RequestWithCustomerUser) {
    return this.customerPortalService.listMyBookings(req.customerUser);
  }

  @Post('claim/request')
  @UseGuards(CustomerPortalAuthGuard)
  requestClaim(@Req() req: RequestWithCustomerUser) {
    return this.customerPortalService.requestClaimCode(req.customerUser);
  }

  @Post('claim/confirm')
  @UseGuards(CustomerPortalAuthGuard)
  confirmClaim(@Req() req: RequestWithCustomerUser, @Body() body: ConfirmClaimCodeDto) {
    return this.customerPortalService.confirmClaimCode(req.customerUser, body.code);
  }
}
