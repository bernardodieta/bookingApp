import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UnifiedRegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsOptional()
  fullName?: string;
}
