import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { TenantSettingsService } from './tenant-settings.service';

type RequestWithUser = Request & { user: AuthUser };

@Controller('tenant/settings')
@UseGuards(AuthGuard)
export class TenantSettingsController {
  constructor(private readonly tenantSettingsService: TenantSettingsService) {}

  @Get()
  get(@Req() req: RequestWithUser) {
    return this.tenantSettingsService.get(req.user);
  }

  @Patch()
  update(@Req() req: RequestWithUser, @Body() body: UpdateTenantSettingsDto) {
    return this.tenantSettingsService.update(req.user, body);
  }
}
