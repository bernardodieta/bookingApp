import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';
import { CreateAvailabilityExceptionDto } from './dto/create-availability-exception.dto';
import { UpdateAvailabilityExceptionDto } from './dto/update-availability-exception.dto';

type RequestWithUser = Request & { user: AuthUser };

@Controller('availability')
@UseGuards(AuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post('rules')
  createRule(@Req() req: RequestWithUser, @Body() body: CreateAvailabilityRuleDto) {
    return this.availabilityService.createRule(req.user, body);
  }

  @Get('rules')
  listRules(@Req() req: RequestWithUser) {
    return this.availabilityService.listRules(req.user);
  }

  @Patch('rules/:id')
  updateRule(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: UpdateAvailabilityRuleDto) {
    return this.availabilityService.updateRule(req.user, id, body);
  }

  @Delete('rules/:id')
  removeRule(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.availabilityService.removeRule(req.user, id);
  }

  @Post('exceptions')
  createException(@Req() req: RequestWithUser, @Body() body: CreateAvailabilityExceptionDto) {
    return this.availabilityService.createException(req.user, body);
  }

  @Get('exceptions')
  listExceptions(@Req() req: RequestWithUser) {
    return this.availabilityService.listExceptions(req.user);
  }

  @Patch('exceptions/:id')
  updateException(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: UpdateAvailabilityExceptionDto
  ) {
    return this.availabilityService.updateException(req.user, id, body);
  }

  @Delete('exceptions/:id')
  removeException(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.availabilityService.removeException(req.user, id);
  }
}
