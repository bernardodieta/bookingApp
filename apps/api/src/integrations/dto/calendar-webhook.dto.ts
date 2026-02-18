import { IsOptional, IsString } from 'class-validator';

export class CalendarWebhookDto {
  @IsOptional()
  @IsString()
  accountId?: string;
}
