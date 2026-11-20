import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CalendarModule } from '../calendar/calendar.module';
import { CompaniesModule } from '../companies/companies.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

import { CandidatesController } from './controller/candidates.controller';
import { CandidatesRepository } from './repositories/candidates.repository';
import { CandidateGeocodeService } from './service/candidate-geocode.service';
import { CandidateExportService } from './service/candidate-export.service';
import { CandidateZoomService } from './service/candidate-zoom.service';
import { CandidatesService } from './service/candidates.service';
import { ResumeParserService } from './service/resume-parser.service';

@Module({
  imports: [AuditLogsModule, CalendarModule, CompaniesModule, NotificationsModule, UsersModule],
  controllers: [CandidatesController],
  providers: [CandidatesService, CandidateExportService, CandidateZoomService, CandidatesRepository, ResumeParserService, CandidateGeocodeService],
  exports: [CandidatesService, CandidatesRepository],
})
export class CandidatesModule {}
