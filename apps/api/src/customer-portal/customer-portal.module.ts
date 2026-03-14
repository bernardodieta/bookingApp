import { Module } from '@nestjs/common';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerPortalAuthGuard } from './customer-portal-auth.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [NotificationsModule, AuthModule],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService, CustomerPortalAuthGuard]
})
export class CustomerPortalModule {}
