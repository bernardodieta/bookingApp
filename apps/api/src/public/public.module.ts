import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PublicBookingsController } from './public-bookings.controller';

@Module({
  imports: [BookingsModule],
  controllers: [PublicBookingsController]
})
export class PublicModule {}
