import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminCreateTenantDto } from './dto/admin-create-tenant.dto';
import { AdminChangePlanDto } from './dto/admin-change-plan.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tenants')
  listTenants() {
    return this.adminService.listTenants();
  }

  @Post('tenants')
  createTenant(@Body() body: AdminCreateTenantDto) {
    return this.adminService.createTenant(body);
  }

  @Patch('tenants/:id/plan')
  changePlan(@Param('id') id: string, @Body() body: AdminChangePlanDto) {
    return this.adminService.changePlan(id, body.plan);
  }

  @Delete('tenants/:id')
  deleteTenant(@Param('id') id: string) {
    return this.adminService.deleteTenant(id);
  }
}
