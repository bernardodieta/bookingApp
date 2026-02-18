import { IsDateString } from 'class-validator';

export class RescheduleBookingDto {
  @IsDateString()
  startAt!: string;
}
