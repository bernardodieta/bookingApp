import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

type RequestWithUser = Request & { user: AuthUser };

@Controller('services')
@UseGuards(AuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  create(@Req() req: RequestWithUser, @Body() body: CreateServiceDto) {
    return this.servicesService.create(req.user, body);
  }

  @Get()
  list(@Req() req: RequestWithUser) {
    return this.servicesService.list(req.user);
  }

  @Patch(':id')
  update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: UpdateServiceDto) {
    return this.servicesService.update(req.user, id, body);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.servicesService.remove(req.user, id);
  }
}
