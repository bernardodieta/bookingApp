import { BookingsRemindersScheduler } from './bookings-reminders.scheduler';

describe('BookingsRemindersScheduler', () => {
  const originalAutoEnabled = process.env.REMINDERS_AUTO_ENABLED;

  afterEach(() => {
    process.env.REMINDERS_AUTO_ENABLED = originalAutoEnabled;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('ejecuta recordatorios para todos los tenants con reminder activo', async () => {
    const prisma = {
      tenant: {
        findMany: jest.fn().mockResolvedValue([{ id: 'tenant-1' }, { id: 'tenant-2' }])
      }
    };

    const bookingsService = {
      runDueRemindersForTenant: jest.fn().mockResolvedValue(undefined)
    };

    const scheduler = new BookingsRemindersScheduler(prisma as never, bookingsService as never);
    await scheduler.runCycle();

    expect(prisma.tenant.findMany).toHaveBeenCalledTimes(1);
    expect(bookingsService.runDueRemindersForTenant).toHaveBeenNthCalledWith(1, 'tenant-1', 'system:reminder-scheduler');
    expect(bookingsService.runDueRemindersForTenant).toHaveBeenNthCalledWith(2, 'tenant-2', 'system:reminder-scheduler');
  });

  it('continúa con otros tenants si uno falla', async () => {
    const prisma = {
      tenant: {
        findMany: jest.fn().mockResolvedValue([{ id: 'tenant-1' }, { id: 'tenant-2' }])
      }
    };

    const bookingsService = {
      runDueRemindersForTenant: jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(undefined)
    };

    const scheduler = new BookingsRemindersScheduler(prisma as never, bookingsService as never);
    await scheduler.runCycle();

    expect(bookingsService.runDueRemindersForTenant).toHaveBeenCalledTimes(2);
    expect(bookingsService.runDueRemindersForTenant).toHaveBeenNthCalledWith(1, 'tenant-1', 'system:reminder-scheduler');
    expect(bookingsService.runDueRemindersForTenant).toHaveBeenNthCalledWith(2, 'tenant-2', 'system:reminder-scheduler');
  });

  it('no inicia intervalo cuando REMINDERS_AUTO_ENABLED=false', () => {
    process.env.REMINDERS_AUTO_ENABLED = 'false';

    const prisma = {
      tenant: {
        findMany: jest.fn()
      }
    };

    const bookingsService = {
      runDueRemindersForTenant: jest.fn()
    };

    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const scheduler = new BookingsRemindersScheduler(prisma as never, bookingsService as never);
    scheduler.onModuleInit();

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
