import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CustomersService } from './customers.service';
import { CustomersQueryDto } from './dto/customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type RequestWithUser = Request & { user: AuthUser };

@Controller('customers')
@UseGuards(AuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Req() req: RequestWithUser, @Query() query: CustomersQueryDto) {
    return this.customersService.list(req.user, query);
  }

  @Get(':id')
  getById(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.customersService.getById(req.user, id);
  }

  @Patch(':id')
  update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customersService.update(req.user, id, body);
  }
}
