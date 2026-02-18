import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user.type';
import { AvailabilityService } from './availability.service';

function createAvailabilityService() {
  const prisma = {
    staff: { findFirst: jest.fn() },
    availabilityRule: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    availabilityException: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  };

  const service = new AvailabilityService(prisma as never);
  return { service, prisma };
}

const user: AuthUser = {
  sub: 'user-1',
  tenantId: 'tenant-1',
  email: 'owner@example.com'
};

describe('AvailabilityService (unit)', () => {
  it('actualiza regla existente del tenant', async () => {
    const { service, prisma } = createAvailabilityService();

    prisma.availabilityRule.findFirst.mockResolvedValue({
      id: 'rule-1',
      tenantId: user.tenantId,
      startTime: '09:00',
      endTime: '18:00'
    });
    prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', tenantId: user.tenantId });
    prisma.availabilityRule.update.mockResolvedValue({ id: 'rule-1', isActive: false });

    const result = await service.updateRule(user, 'rule-1', {
      startTime: '10:00',
      endTime: '18:00',
      staffId: 'staff-1',
      isActive: false
    });

    expect(prisma.availabilityRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: {
        startTime: '10:00',
        endTime: '18:00',
        staffId: 'staff-1',
        isActive: false
      }
    });
    expect(result).toEqual({ id: 'rule-1', isActive: false });
  });

  it('lanza BadRequest al actualizar regla con staff fuera del tenant', async () => {
    const { service, prisma } = createAvailabilityService();

    prisma.availabilityRule.findFirst.mockResolvedValue({
      id: 'rule-1',
      tenantId: user.tenantId,
      startTime: '09:00',
      endTime: '18:00'
    });
    prisma.staff.findFirst.mockResolvedValue(null);

    await expect(
      service.updateRule(user, 'rule-1', {
        staffId: 'staff-otro-tenant'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('elimina excepción existente del tenant', async () => {
    const { service, prisma } = createAvailabilityService();

    prisma.availabilityException.findFirst.mockResolvedValue({ id: 'ex-1', tenantId: user.tenantId });
    prisma.availabilityException.delete.mockResolvedValue({ id: 'ex-1' });

    const result = await service.removeException(user, 'ex-1');

    expect(prisma.availabilityException.delete).toHaveBeenCalledWith({ where: { id: 'ex-1' } });
    expect(result).toEqual({ id: 'ex-1' });
  });

  it('lanza NotFound al eliminar regla inexistente', async () => {
    const { service, prisma } = createAvailabilityService();

    prisma.availabilityRule.findFirst.mockResolvedValue(null);

    await expect(service.removeRule(user, 'rule-missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.availabilityRule.delete).not.toHaveBeenCalled();
  });
});
