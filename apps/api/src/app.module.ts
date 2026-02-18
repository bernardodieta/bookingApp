import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { ServicesModule } from './services/services.module';
import { StaffModule } from './staff/staff.module';
import { PrismaModule } from './prisma/prisma.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingsModule } from './bookings/bookings.module';
import { TenantSettingsModule } from './tenant-settings/tenant-settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PublicModule } from './public/public.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CustomersModule } from './customers/customers.module';
import { AuditModule } from './audit/audit.module';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { PaymentsModule } from './payments/payments.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ServicesModule,
    StaffModule,
    AvailabilityModule,
    BookingsModule,
    TenantSettingsModule,
    NotificationsModule,
    PublicModule,
    DashboardModule,
    CustomersModule,
    AuditModule,
    PaymentsModule,
    CustomerPortalModule,
    IntegrationsModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes(
        { path: 'public/:path*', method: RequestMethod.ALL },
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/google', method: RequestMethod.POST },
        { path: 'integrations/calendar/webhooks/:path*', method: RequestMethod.POST }
      );
  }
}
