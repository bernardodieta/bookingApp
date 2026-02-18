import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

type RequestWithUser = Request & { user: AuthUser };

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('appointments')
  appointments(@Req() req: RequestWithUser, @Query() query: DashboardQueryDto) {
    return this.dashboardService.getAppointments(req.user, query);
  }

  @Get('reports')
  reports(@Req() req: RequestWithUser, @Query() query: DashboardQueryDto) {
    return this.dashboardService.getReports(req.user, query);
  }
}
