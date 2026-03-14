import { Body, Controller, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanRequestDto } from '../admin/dto/create-plan-request.dto';

@Controller('public')
export class PlanRequestsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('plan-requests')
  async create(@Body() dto: CreatePlanRequestDto) {
    const request = await this.prisma.planRequest.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        businessName: dto.businessName,
        requestedPlan: dto.requestedPlan,
        message: dto.message,
      },
    });
    return { id: request.id, status: request.status };
  }
}
