import { IsString, Length } from 'class-validator';

export class ConfirmClaimCodeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
