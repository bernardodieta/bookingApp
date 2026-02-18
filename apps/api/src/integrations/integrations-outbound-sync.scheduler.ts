import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

const DEFAULT_INTERVAL_MS = 30 * 1000;
const MIN_INTERVAL_MS = 5 * 1000;

@Injectable()
export class IntegrationsOutboundSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationsOutboundSyncScheduler.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly integrationsService: IntegrationsService) {}

  onModuleInit() {
    if (!this.isSchedulerEnabled()) {
      this.logger.log('Calendar outbound sync scheduler deshabilitado (CALENDAR_SYNC_OUTBOUND_AUTO_ENABLED=false).');
      return;
    }

    const intervalMs = this.getIntervalMs();
    this.intervalRef = setInterval(() => {
      void this.runCycle();
    }, intervalMs);
    void this.runCycle();
    this.logger.log(`Calendar outbound sync scheduler habilitado cada ${intervalMs}ms.`);
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
      const batchSize = this.getBatchSize();
      await this.integrationsService.processDueOutboundSyncJobs(batchSize);
    } catch (error) {
      this.logger.warn(
        `Falló ciclo de calendar outbound sync: ${error instanceof Error ? error.message : 'error desconocido'}`
      );
    } finally {
      this.isRunning = false;
    }
  }

  private isSchedulerEnabled() {
    return process.env.CALENDAR_SYNC_OUTBOUND_AUTO_ENABLED !== 'false';
  }

  private getIntervalMs() {
    const rawInterval = Number.parseInt(process.env.CALENDAR_SYNC_OUTBOUND_INTERVAL_MS ?? '', 10);
    if (!Number.isFinite(rawInterval) || rawInterval <= 0) {
      return DEFAULT_INTERVAL_MS;
    }

    return Math.max(rawInterval, MIN_INTERVAL_MS);
  }

  private getBatchSize() {
    const rawBatchSize = Number.parseInt(process.env.CALENDAR_SYNC_OUTBOUND_BATCH_SIZE ?? '', 10);
    if (!Number.isFinite(rawBatchSize) || rawBatchSize <= 0) {
      return 10;
    }

    return Math.min(Math.max(rawBatchSize, 1), 50);
  }
}
