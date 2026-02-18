import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class PublicSlotsQueryDto {
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsString()
  @IsNotEmpty()
  staffId!: string;

  @IsDateString()
  date!: string;
}
