import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { TimesheetsModule } from '../timesheets/timesheets.module';

import { PayrollController } from './controller/payroll.controller';
import { PayrollService } from './service/payroll.service';

@Module({
  imports: [AuditLogsModule, TimesheetsModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
