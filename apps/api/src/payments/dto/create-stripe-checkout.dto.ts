import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUrl } from 'class-validator';

export class CreateStripeCheckoutDto {
  @IsString()
  bookingId!: string;

  @IsIn(['full', 'deposit'])
  mode!: 'full' | 'deposit';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsUrl()
  successUrl?: string;

  @IsOptional()
  @IsUrl()
  cancelUrl?: string;
}
