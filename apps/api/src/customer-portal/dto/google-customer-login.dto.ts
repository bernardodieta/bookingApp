import { IsString } from 'class-validator';

export class GoogleCustomerLoginDto {
  @IsString()
  idToken!: string;
}
