import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { IntegrationsService } from './integrations.service';
import { ConnectGoogleCalendarDto } from './dto/connect-google-calendar.dto';
import { ConnectMicrosoftCalendarDto } from './dto/connect-microsoft-calendar.dto';

type RequestWithUser = Request & { user: AuthUser };

@Controller('integrations/calendar')
@UseGuards(AuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('google/connect')
  connectGoogle(@Req() req: RequestWithUser, @Body() body: ConnectGoogleCalendarDto) {
    return this.integrationsService.connectGoogleCalendar(req.user, body);
  }

  @Post('microsoft/connect')
  connectMicrosoft(@Req() req: RequestWithUser, @Body() body: ConnectMicrosoftCalendarDto) {
    return this.integrationsService.connectMicrosoftCalendar(req.user, body);
  }

  @Get('accounts')
  listAccounts(@Req() req: RequestWithUser) {
    return this.integrationsService.listCalendarAccounts(req.user);
  }

  @Post('accounts/:id/resync')
  resync(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.integrationsService.requestCalendarResync(req.user, id);
  }

  @Delete('accounts/:id')
  disconnect(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.integrationsService.disconnectCalendarAccount(req.user, id);
  }
}
