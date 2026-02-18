import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { AuditService } from './audit.service';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

type RequestWithUser = Request & { user: AuthUser };

@Controller('audit')
@UseGuards(AuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  logs(@Req() req: RequestWithUser, @Query() query: AuditLogsQueryDto) {
    return this.auditService.list(req.user, query);
  }
}