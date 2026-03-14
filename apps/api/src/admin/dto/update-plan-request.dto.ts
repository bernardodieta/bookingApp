import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PlanRequestStatus } from '@prisma/client';

export class UpdatePlanRequestDto {
  @IsOptional()
  @IsEnum(PlanRequestStatus)
  status?: PlanRequestStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
