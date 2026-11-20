import { CurrentTenant, CurrentUser, Permissions, Public } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { AssignUnmatchedDto, BulkPreviewDto, BulkSendDto, ConnectDialpadDto, SendSmsDto, SetDialpadNumberDto, TemplateDto, UpdateTemplateDto } from '../dto';
import { PLACEHOLDERS } from '../lib/placeholders';
import { BulkSmsService } from '../service/bulk-sms.service';
import { CommunicationsService } from '../service/communications.service';
import { DialpadConnectionService } from '../service/dialpad-connection.service';
import { DialpadWebhookService } from '../service/dialpad-webhook.service';
import { MessageTemplatesService } from '../service/message-templates.service';

/** Settings → Connections & API → Dialpad. Whoever can send messages can connect it and choose the number; only an administrator can remove the connection. The API key is accepted here and never sent back. */
@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations/dialpad')
export class DialpadIntegrationController {
  constructor(private readonly connection: DialpadConnectionService) {}

  @Get()
  @Permissions(PERMISSIONS.COMMUNICATION.SEND)
  status(@CurrentTenant() organisationId: string) {
    return this.connection.status(organisationId);
  }

  @Put()
  @Permissions(PERMISSIONS.COMMUNICATION.SEND)
  connect(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: ConnectDialpadDto) {
    return this.connection.connect(organisationId, user.sub, dto);
  }

  @Patch('number')
  @Permissions(PERMISSIONS.COMMUNICATION.SEND)
  setNumber(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: SetDialpadNumberDto) {
    return this.connection.setBusinessNumber(organisationId, user.sub, dto.fromNumber);
  }

  @Get('numbers')
  @Permissions(PERMISSIONS.COMMUNICATION.SEND)
  numbers(@CurrentTenant() organisationId: string) {
    return this.connection.availableNumbers(organisationId);
  }

  @Post('health')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.COMMUNICATION.SEND)
  health(@CurrentTenant() organisationId: string) {
    return this.connection.health(organisationId);
  }

  @Delete()
  @Permissions(PERMISSIONS.SETTINGS.MANAGE)
  disconnect(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload) {
    return this.connection.disconnect(organisationId, user.sub);
  }
}

@ApiTags('communications')
@ApiBearerAuth()
@Controller()
export class CommunicationsController {
  constructor(
    private readonly comms: CommunicationsService,
    private readonly bulk: BulkSmsService,
    private readonly connection: DialpadConnectionService,
  ) {}

  /** What the screens need to know to show (or hide) the Call and Text buttons — no credentials, no settings access needed. */
  @Get('communications/status')
  @Permissions(PERMISSIONS.CANDIDATE.READ)
  async status(@CurrentTenant() organisationId: string) {
    const s = await this.connection.status(organisationId);
    return { connected: s.connected && Boolean(s.fromNumber), fromNumber: s.fromNumber, placeholders: PLACEHOLDERS };
  }

  @Get('candidates/:id/communications')
  @Permissions(PERMISSIONS.CANDIDATE.READ)
  history(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.comms.history(organisationId, id);
  }

  @Post('candidates/:id/call')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.COMMUNICATION.SEND)
  call(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.comms.callCandidate(organisationId, user.sub, user.email, id);
  }

  @Post('candidates/:id/sms')
  @Permissions(PERMISSIONS.COMMUNICATION.SEND)
  async sms(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: SendSmsDto) {
    return this.comms.sendSms(organisationId, user.sub, await this.comms.recruiterName(organisationId, user.sub), id, dto.text, dto.jobId);
  }

  @Post('communications/bulk/preview')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.COMMUNICATION.BULK)
  async bulkPreview(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: BulkPreviewDto) {
    return this.bulk.preview(organisationId, await this.comms.recruiterName(organisationId, user.sub), dto.selection, dto.text, dto.jobId);
  }

  @Post('communications/bulk')
  @Permissions(PERMISSIONS.COMMUNICATION.BULK)
  async bulkSend(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: BulkSendDto) {
    return this.bulk.send(organisationId, user.sub, await this.comms.recruiterName(organisationId, user.sub), { selection: dto.selection, template: dto.text, jobId: dto.jobId, idempotencyKey: dto.idempotencyKey });
  }

  @Get('communications/batches/:id')
  @Permissions(PERMISSIONS.COMMUNICATION.BULK)
  batch(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.bulk.batchStatus(organisationId, id);
  }

  @Get('communications/unmatched')
  @Permissions(PERMISSIONS.SETTINGS.MANAGE)
  unmatched(@CurrentTenant() organisationId: string, @Query('take') take?: string) {
    return this.comms.unmatched(organisationId, take ? Number(take) : 100);
  }

  @Post('communications/:id/assign')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.SETTINGS.MANAGE)
  assign(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string, @Body() dto: AssignUnmatchedDto) {
    return this.comms.assignUnmatched(organisationId, id, dto.candidateId);
  }
}

@ApiTags('message-templates')
@ApiBearerAuth()
@Controller('message-templates')
export class MessageTemplatesController {
  constructor(private readonly templates: MessageTemplatesService) {}

  @Get()
  @Permissions(PERMISSIONS.COMMUNICATION.SEND)
  list(@CurrentTenant() organisationId: string) {
    return this.templates.list(organisationId);
  }

  @Post()
  @Permissions(PERMISSIONS.TEMPLATE.MANAGE)
  create(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: TemplateDto) {
    return this.templates.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.TEMPLATE.MANAGE)
  update(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateTemplateDto) {
    return this.templates.update(organisationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PERMISSIONS.TEMPLATE.MANAGE)
  remove(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.templates.remove(organisationId, user.sub, id);
  }
}

/** Dialpad calls this. Open to the internet by design; the secret path token picks the organisation and the JWT signature proves it is Dialpad. */
@ApiTags('webhooks')
@Controller('webhooks/dialpad')
export class DialpadWebhookController {
  constructor(private readonly webhook: DialpadWebhookService) {}

  @Public()
  @Post(':token')
  @HttpCode(HttpStatus.OK)
  async receive(@Param('token') token: string, @Req() req: Request) {
    const raw = await readRawBody(req);
    const outcome = await this.webhook.handle(token, raw);
    if (outcome === 'unknown_endpoint') throw new NotFoundException();
    if (outcome === 'bad_signature') throw new UnauthorizedException();
    return { received: true };
  }
}

/** The body as text, whether or not a body parser already read it (Dialpad sends the signed token as plain text). */
async function readRawBody(req: Request): Promise<string> {
  const parsed = (req as Request & { body?: unknown }).body;
  if (typeof parsed === 'string' && parsed) return parsed;
  if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
    const asObject = parsed as Record<string, unknown>;
    return typeof asObject.jwt === 'string' ? asObject.jwt : '';
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1_000_000) return '';
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
