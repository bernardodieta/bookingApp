import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PlanRequestStatus } from '@prisma/client';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminCreateTenantDto } from './dto/admin-create-tenant.dto';
import { AdminChangePlanDto } from './dto/admin-change-plan.dto';
import { UpdatePlanRequestDto } from './dto/update-plan-request.dto';

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

  @Get('plan-requests')
  listPlanRequests(@Query('status') status?: PlanRequestStatus) {
    return this.adminService.listPlanRequests(status);
  }

  @Patch('plan-requests/:id')
  updatePlanRequest(@Param('id') id: string, @Body() body: UpdatePlanRequestDto) {
    return this.adminService.updatePlanRequest(id, body);
  }
}
