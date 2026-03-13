import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

type RequestWithUser = Request & { user: AuthUser };

@Controller('bookings')
@UseGuards(AuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles('owner')
  create(@Req() req: RequestWithUser, @Body() body: CreateBookingDto) {
    return this.bookingsService.create(req.user, body);
  }

  @Get()
  @Roles('owner')
  list(@Req() req: RequestWithUser) {
    return this.bookingsService.list(req.user);
  }

  @Get('my')
  listMy(@Req() req: RequestWithUser, @Query('status') status?: string) {
    return this.bookingsService.listForUser(req.user, status);
  }

  @Patch(':id/cancel')
  cancel(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: CancelBookingDto) {
    return this.bookingsService.cancel(req.user, id, body);
  }

  @Patch(':id/reschedule')
  @Roles('owner')
  reschedule(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: RescheduleBookingDto) {
    return this.bookingsService.reschedule(req.user, id, body);
  }

  @Post('waitlist')
  @Roles('owner')
  joinWaitlist(@Req() req: RequestWithUser, @Body() body: JoinWaitlistDto) {
    return this.bookingsService.joinWaitlist(req.user, body);
  }

  @Post('reminders/run')
  @Roles('owner')
  runReminders(@Req() req: RequestWithUser) {
    return this.bookingsService.runDueReminders(req.user);
  }
}
