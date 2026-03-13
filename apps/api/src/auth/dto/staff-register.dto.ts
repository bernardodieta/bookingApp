import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class StaffRegisterDto {
  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
