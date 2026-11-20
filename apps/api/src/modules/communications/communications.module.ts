import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CandidatesModule } from '../candidates/candidates.module';

import {
  CommunicationsController,
  DialpadIntegrationController,
  DialpadWebhookController,
  MessageTemplatesController,
} from './controller/communications.controller';
import { BulkSmsService } from './service/bulk-sms.service';
import { CommunicationsService } from './service/communications.service';
import { DialpadConnectionService } from './service/dialpad-connection.service';
import { DialpadWebhookService } from './service/dialpad-webhook.service';
import { MessageTemplatesService } from './service/message-templates.service';

/**
 * Calls and texts through the company's Dialpad account: connection settings, per-candidate history, individual and
 * bulk SMS (with the consent rules of the candidate module), message templates, and the webhook that brings
 * delivery results and incoming calls/texts back.
 */
@Module({
  imports: [AuditLogsModule, CandidatesModule],
  controllers: [DialpadIntegrationController, CommunicationsController, MessageTemplatesController, DialpadWebhookController],
  providers: [DialpadConnectionService, CommunicationsService, BulkSmsService, DialpadWebhookService, MessageTemplatesService],
  exports: [CommunicationsService, DialpadConnectionService],
})
export class CommunicationsModule {}
