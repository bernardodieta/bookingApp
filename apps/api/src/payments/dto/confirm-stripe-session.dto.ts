import { IsString } from 'class-validator';

export class ConfirmStripeSessionDto {
  @IsString()
  sessionId!: string;
}
