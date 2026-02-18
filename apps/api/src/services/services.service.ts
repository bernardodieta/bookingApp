import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  create(user: AuthUser, payload: CreateServiceDto) {
    return this.prisma.service.create({
      data: {
        tenantId: user.tenantId,
        name: payload.name,
        durationMinutes: payload.durationMinutes,
        price: payload.price,
        active: payload.active ?? true
      }
    });
  }

  list(user: AuthUser) {
    return this.prisma.service.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(user: AuthUser, id: string, payload: UpdateServiceDto) {
    const service = await this.prisma.service.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!service) {
      throw new NotFoundException('Servicio no encontrado.');
    }

    return this.prisma.service.update({
      where: { id },
      data: payload
    });
  }

  async remove(user: AuthUser, id: string) {
    const service = await this.prisma.service.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!service) {
      throw new NotFoundException('Servicio no encontrado.');
    }

    return this.prisma.service.delete({ where: { id } });
  }
}
