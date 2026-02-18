import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from './bookings.service';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const MIN_INTERVAL_MS = 15 * 1000;
const SCHEDULER_ACTOR = 'system:reminder-scheduler';

@Injectable()
export class BookingsRemindersScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingsRemindersScheduler.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService
  ) {}

  onModuleInit() {
    if (!this.isSchedulerEnabled()) {
      this.logger.log('Auto-reminders deshabilitados (REMINDERS_AUTO_ENABLED=false).');
      return;
    }

    const intervalMs = this.getIntervalMs();
    this.intervalRef = setInterval(() => {
      void this.runCycle();
    }, intervalMs);
    void this.runCycle();
    this.logger.log(`Auto-reminders habilitados cada ${intervalMs}ms.`);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async runCycle() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: {
          reminderHoursBefore: {
            gt: 0
          }
        },
        select: {
          id: true
        }
      });

      for (const tenant of tenants) {
        try {
          await this.bookingsService.runDueRemindersForTenant(tenant.id, SCHEDULER_ACTOR);
        } catch (error) {
          this.logger.warn(
            `Falló ejecución de recordatorios para tenant ${tenant.id}: ${
              error instanceof Error ? error.message : 'error desconocido'
            }`
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Falló ciclo de auto-reminders: ${error instanceof Error ? error.message : 'error desconocido'}`
      );
    } finally {
      this.isRunning = false;
    }
  }

  private isSchedulerEnabled() {
    return process.env.REMINDERS_AUTO_ENABLED !== 'false';
  }

  private getIntervalMs() {
    const rawInterval = Number.parseInt(process.env.REMINDERS_RUN_INTERVAL_MS ?? '', 10);
    if (!Number.isFinite(rawInterval) || rawInterval <= 0) {
      return DEFAULT_INTERVAL_MS;
    }

    return Math.max(rawInterval, MIN_INTERVAL_MS);
  }
}
