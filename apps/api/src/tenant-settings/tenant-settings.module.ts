import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsService } from './tenant-settings.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantSettingsController],
  providers: [TenantSettingsService]
})
export class TenantSettingsModule {}
