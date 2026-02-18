import { IsOptional, IsString } from 'class-validator';

export class CustomersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
