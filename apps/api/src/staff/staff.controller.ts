import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

type RequestWithUser = Request & { user: AuthUser };

@Controller('staff')
@UseGuards(AuthGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  create(@Req() req: RequestWithUser, @Body() body: CreateStaffDto) {
    return this.staffService.create(req.user, body);
  }

  @Get()
  list(@Req() req: RequestWithUser) {
    return this.staffService.list(req.user);
  }

  @Patch(':id')
  update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: UpdateStaffDto) {
    return this.staffService.update(req.user, id, body);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.staffService.remove(req.user, id);
  }
}
