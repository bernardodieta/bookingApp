import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveCalendarConflictDto {
  @IsIn(['dismiss', 'retry_sync'])
  action!: 'dismiss' | 'retry_sync';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
