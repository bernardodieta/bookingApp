import { RefundPolicy } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  bookingBufferMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxBookingsPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxBookingsPerWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationNoticeHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rescheduleNoticeHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reminderHoursBefore?: number;

  @IsOptional()
  @IsEnum(RefundPolicy)
  refundPolicy?: RefundPolicy;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  bookingFormFields?: Array<Record<string, unknown>>;
}
