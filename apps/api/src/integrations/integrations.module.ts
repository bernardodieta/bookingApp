import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsWebhooksController } from './integrations-webhooks.controller';
import { IntegrationsOutboundSyncScheduler } from './integrations-outbound-sync.scheduler';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [AuditModule],
  controllers: [IntegrationsController, IntegrationsWebhooksController],
  providers: [IntegrationsService, IntegrationsOutboundSyncScheduler],
  exports: [IntegrationsService]
})
export class IntegrationsModule {}
