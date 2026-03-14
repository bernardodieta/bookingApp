import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicBookingsController } from './public-bookings.controller';
import { PlanRequestsController } from './plan-requests.controller';

@Module({
  imports: [BookingsModule, PrismaModule],
  controllers: [PublicBookingsController, PlanRequestsController]
})
export class PublicModule {}
