import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
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

    const normalizedEmail = payload.email.toLowerCase();

    const newStaff = await this.prisma.staff.create({
      data: {
        tenantId: user.tenantId,
        fullName: payload.fullName,
        email: normalizedEmail,
        active: payload.active ?? true,
        university: payload.university,
        degree: payload.degree,
        specialty: payload.specialty,
        bio: payload.bio,
        graduationYear: payload.graduationYear,
        photoUrl: payload.photoUrl
      }
    });

    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, tenantId: user.tenantId, role: 'staff' }
    });
    if (existingUser) {
      return this.prisma.staff.update({
        where: { id: newStaff.id },
        data: { userId: existingUser.id }
      });
    }

    return newStaff;
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

  async getMyProfile(user: AuthUser) {
    if (!user.staffId) {
      throw new NotFoundException('No tienes un perfil de staff asociado.');
    }

    const staff = await this.prisma.staff.findFirst({
      where: { id: user.staffId, tenantId: user.tenantId }
    });

    if (!staff) {
      throw new NotFoundException('Perfil de staff no encontrado.');
    }

    return staff;
  }

  async updateMyProfile(user: AuthUser, dto: UpdateStaffProfileDto) {
    if (!user.staffId) {
      throw new NotFoundException('No tienes un perfil de staff asociado.');
    }

    const staff = await this.prisma.staff.findFirst({
      where: { id: user.staffId, tenantId: user.tenantId }
    });

    if (!staff) {
      throw new NotFoundException('Perfil de staff no encontrado.');
    }

    return this.prisma.staff.update({
      where: { id: user.staffId },
      data: dto
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
