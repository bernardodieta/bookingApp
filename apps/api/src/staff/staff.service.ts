import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, payload: CreateStaffDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { plan: true }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado.');
    }

    const maxStaff = this.getMaxStaffByPlan(tenant.plan);
    if (maxStaff !== null) {
      const currentStaff = await this.prisma.staff.count({ where: { tenantId: user.tenantId } });
      if (currentStaff >= maxStaff) {
        throw new BadRequestException(
          `Tu plan ${tenant.plan} permite hasta ${maxStaff} empleado(s). Actualiza el plan para agregar más.`
        );
      }
    }

    return this.prisma.staff.create({
      data: {
        tenantId: user.tenantId,
        fullName: payload.fullName,
        email: payload.email.toLowerCase(),
        active: payload.active ?? true
      }
    });
  }

  private getMaxStaffByPlan(plan: Plan) {
    if (plan === 'free') {
      return 1;
    }

    if (plan === 'pro') {
      return 5;
    }

    return null;
  }

  list(user: AuthUser) {
    return this.prisma.staff.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(user: AuthUser, id: string, payload: UpdateStaffDto) {
    const staff = await this.prisma.staff.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!staff) {
      throw new NotFoundException('Empleado no encontrado.');
    }

    if (payload.email) {
      payload.email = payload.email.toLowerCase();
    }

    return this.prisma.staff.update({
      where: { id },
      data: payload
    });
  }

  async remove(user: AuthUser, id: string) {
    const staff = await this.prisma.staff.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!staff) {
      throw new NotFoundException('Empleado no encontrado.');
    }

    return this.prisma.staff.delete({ where: { id } });
  }
}
