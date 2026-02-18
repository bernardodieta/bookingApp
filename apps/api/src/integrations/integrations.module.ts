import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsWebhooksController } from './integrations-webhooks.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [AuditModule],
  controllers: [IntegrationsController, IntegrationsWebhooksController],
  providers: [IntegrationsService]
})
export class IntegrationsModule {}
