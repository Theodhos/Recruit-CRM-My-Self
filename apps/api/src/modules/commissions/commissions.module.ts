import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { CommissionsController } from './controller/commissions.controller';
import { CommissionsService } from './service/commissions.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
