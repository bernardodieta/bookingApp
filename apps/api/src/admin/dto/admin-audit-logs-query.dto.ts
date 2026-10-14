import { IsOptional, IsString } from 'class-validator';
import { AuditLogsQueryDto } from '../../audit/dto/audit-logs-query.dto';

export class AdminAuditLogsQueryDto extends AuditLogsQueryDto {
  @IsOptional()
  @IsString()
  tenantId?: string;
}
