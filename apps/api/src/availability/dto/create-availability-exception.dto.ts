import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAvailabilityExceptionDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsBoolean()
  isUnavailable?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
