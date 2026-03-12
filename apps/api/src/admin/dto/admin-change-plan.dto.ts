import { IsEnum } from 'class-validator';
import { Plan } from '@prisma/client';

export class AdminChangePlanDto {
  @IsEnum(Plan)
  plan!: Plan;
}
