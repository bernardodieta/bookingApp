import { IsString } from 'class-validator';

export class CalendarAuthorizeDto {
  @IsString()
  staffId!: string;
}
