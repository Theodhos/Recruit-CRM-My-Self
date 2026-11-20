import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { PayslipsController } from './controller/payslips.controller';
import { PayslipsRepository } from './repositories/payslips.repository';
import { PayslipsService } from './service/payslips.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [PayslipsController],
  providers: [PayslipsService, PayslipsRepository],
  exports: [PayslipsService],
})
export class PayslipsModule {}
