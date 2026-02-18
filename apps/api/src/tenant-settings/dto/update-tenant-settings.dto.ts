import { RefundPolicy } from '@prisma/client';
import { IsArray, IsEnum, IsHexColor, IsInt, IsObject, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'logoUrl debe ser una URL válida.' })
  logoUrl?: string;

  @IsOptional()
  @IsHexColor({ message: 'primaryColor debe ser un color HEX válido (ej. #2563eb).' })
  primaryColor?: string;

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
