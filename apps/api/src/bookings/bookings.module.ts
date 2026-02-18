import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsRemindersScheduler } from './bookings-reminders.scheduler';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRemindersScheduler],
  exports: [BookingsService]
})
export class BookingsModule {}
