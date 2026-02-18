import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { IntegrationsService } from './integrations.service';
import { ConnectGoogleCalendarDto } from './dto/connect-google-calendar.dto';
import { ConnectMicrosoftCalendarDto } from './dto/connect-microsoft-calendar.dto';
import { CalendarAuthorizeDto } from './dto/calendar-authorize.dto';
import { CalendarConflictsQueryDto } from './dto/calendar-conflicts-query.dto';
import { CalendarMetricsQueryDto } from './dto/calendar-metrics-query.dto';
import { ResolveCalendarConflictDto } from './dto/resolve-calendar-conflict.dto';

type RequestWithUser = Request & { user: AuthUser };

@Controller('integrations/calendar')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('google/authorize')
  @UseGuards(AuthGuard)
  googleAuthorize(@Req() req: RequestWithUser, @Body() body: CalendarAuthorizeDto) {
    return this.integrationsService.createGoogleAuthorizeUrl(req.user, body.staffId);
  }

  @Get('google/callback')
  googleCallback(@Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string) {
    return this.integrationsService.handleGoogleOAuthCallback({ code, state, error });
  }

  @Post('microsoft/authorize')
  @UseGuards(AuthGuard)
  microsoftAuthorize(@Req() req: RequestWithUser, @Body() body: CalendarAuthorizeDto) {
    return this.integrationsService.createMicrosoftAuthorizeUrl(req.user, body.staffId);
  }

  @Get('microsoft/callback')
  microsoftCallback(@Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string) {
    return this.integrationsService.handleMicrosoftOAuthCallback({ code, state, error });
  }

  @Post('google/connect')
  @UseGuards(AuthGuard)
  connectGoogle(@Req() req: RequestWithUser, @Body() body: ConnectGoogleCalendarDto) {
    return this.integrationsService.connectGoogleCalendar(req.user, body);
  }

  @Post('microsoft/connect')
  @UseGuards(AuthGuard)
  connectMicrosoft(@Req() req: RequestWithUser, @Body() body: ConnectMicrosoftCalendarDto) {
    return this.integrationsService.connectMicrosoftCalendar(req.user, body);
  }

  @Get('accounts')
  @UseGuards(AuthGuard)
  listAccounts(@Req() req: RequestWithUser) {
    return this.integrationsService.listCalendarAccounts(req.user);
  }

  @Get('metrics')
  @UseGuards(AuthGuard)
  metrics(@Req() req: RequestWithUser, @Query() query: CalendarMetricsQueryDto) {
    return this.integrationsService.getCalendarMetrics(req.user, query);
  }

  @Get('conflicts')
  @UseGuards(AuthGuard)
  listConflicts(@Req() req: RequestWithUser, @Query() query: CalendarConflictsQueryDto) {
    return this.integrationsService.listInboundConflicts(req.user, query);
  }

  @Get('conflicts/:id/preview')
  @UseGuards(AuthGuard)
  previewConflict(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.integrationsService.previewInboundConflict(req.user, id);
  }

  @Post('conflicts/:id/resolve')
  @UseGuards(AuthGuard)
  resolveConflict(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: ResolveCalendarConflictDto) {
    return this.integrationsService.resolveInboundConflict(req.user, id, body);
  }

  @Post('accounts/:id/resync')
  @UseGuards(AuthGuard)
  resync(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.integrationsService.requestCalendarResync(req.user, id);
  }

  @Delete('accounts/:id')
  @UseGuards(AuthGuard)
  disconnect(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.integrationsService.disconnectCalendarAccount(req.user, id);
  }
}
