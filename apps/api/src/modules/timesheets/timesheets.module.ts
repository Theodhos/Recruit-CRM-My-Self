import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { TimesheetsController } from './controller/timesheets.controller';
import { TimesheetsService } from './service/timesheets.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsService],
  exports: [TimesheetsService],
})
export class TimesheetsModule {}
