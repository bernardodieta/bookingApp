import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Plan } from '@prisma/client';

export class CreatePlanRequestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @IsEnum(Plan)
  requestedPlan!: Plan;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
