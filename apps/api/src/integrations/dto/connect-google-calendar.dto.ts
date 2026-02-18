import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ConnectGoogleCalendarDto {
  @IsString()
  staffId!: string;

  @IsString()
  externalAccountId!: string;

  @IsString()
  calendarId!: string;

  @IsString()
  accessToken!: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsDateString()
  tokenExpiresAt?: string;
}
