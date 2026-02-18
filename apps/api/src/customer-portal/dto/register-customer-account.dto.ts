import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterCustomerAccountDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
