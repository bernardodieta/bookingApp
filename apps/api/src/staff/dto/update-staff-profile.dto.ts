import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateStaffProfileDto {
  @IsOptional()
  @IsString()
  university?: string;

  @IsOptional()
  @IsString()
  degree?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  graduationYear?: number;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
