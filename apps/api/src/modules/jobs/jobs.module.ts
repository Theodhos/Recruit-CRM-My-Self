import { Module } from '@nestjs/common';

import { SchedulerModule } from '../../infrastructure/scheduler/scheduler.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CompaniesModule } from '../companies/companies.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { JobsController } from './controller/jobs.controller';
import { JobsRepository } from './repositories/jobs.repository';
import { JobExpiryService } from './service/job-expiry.service';
import { JobGeocodeService } from './service/job-geocode.service';
import { JobsService } from './service/jobs.service';

@Module({
  imports: [AuditLogsModule, CompaniesModule, NotificationsModule, SchedulerModule],
  controllers: [JobsController],
  providers: [JobsService, JobsRepository, JobExpiryService, JobGeocodeService],
  exports: [JobsService],
})
export class JobsModule {}
