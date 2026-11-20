import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../../common/exceptions/app.exception';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { inspectTemplate, MAX_SMS_LENGTH } from '../lib/placeholders';

@Injectable()
export class MessageTemplatesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  list(organisationId: string) {
    return this.db.forTenant(organisationId).messageTemplate.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, body: true, updatedAt: true, createdBy: { select: { firstName: true, lastName: true } } } });
  }

  private validate(body: string) {
    if (body.length > MAX_SMS_LENGTH) throw new AppException('MESSAGE_TOO_LONG', `A template can be at most ${MAX_SMS_LENGTH} characters.`, HttpStatus.BAD_REQUEST);
    const { unknown } = inspectTemplate(body);
    if (unknown.length) {
      throw new AppException('UNKNOWN_PLACEHOLDER', `Unknown placeholder: ${unknown.map((u) => `{{${u}}}`).join(', ')}. Use firstName, lastName, fullName, jobTitle or recruiterName.`, HttpStatus.BAD_REQUEST);
    }
  }

  async create(organisationId: string, userId: string, dto: { name: string; body: string }) {
    this.validate(dto.body);
    const taken = await this.db.client.messageTemplate.findUnique({ where: { organisationId_name: { organisationId, name: dto.name.trim() } } });
    if (taken) throw new AppException('TEMPLATE_EXISTS', 'A template with this name already exists.', HttpStatus.CONFLICT);
    const row = await this.db.client.messageTemplate.create({ data: { organisationId, name: dto.name.trim(), body: dto.body, createdById: userId } });
    await this.auditLogs.record({ organisationId, userId, action: 'CREATE_MESSAGE_TEMPLATE', entityType: 'MessageTemplate', entityId: row.id, newValues: { name: row.name } });
    return row;
  }

  async update(organisationId: string, userId: string, id: string, dto: { name?: string; body?: string }) {
    const current = await this.db.client.messageTemplate.findFirst({ where: { id, organisationId } });
    if (!current) throw new AppException('NOT_FOUND', 'Template not found.', HttpStatus.NOT_FOUND);
    if (dto.body !== undefined) this.validate(dto.body);
    const name = dto.name?.trim();
    if (name && name !== current.name) {
      const taken = await this.db.client.messageTemplate.findUnique({ where: { organisationId_name: { organisationId, name } } });
      if (taken) throw new AppException('TEMPLATE_EXISTS', 'A template with this name already exists.', HttpStatus.CONFLICT);
    }
    const row = await this.db.client.messageTemplate.update({ where: { id }, data: { ...(name ? { name } : {}), ...(dto.body !== undefined ? { body: dto.body } : {}) } });
    await this.auditLogs.record({ organisationId, userId, action: 'UPDATE_MESSAGE_TEMPLATE', entityType: 'MessageTemplate', entityId: id, oldValues: { name: current.name }, newValues: { name: row.name } });
    return row;
  }

  async remove(organisationId: string, userId: string, id: string) {
    const current = await this.db.client.messageTemplate.findFirst({ where: { id, organisationId } });
    if (!current) throw new AppException('NOT_FOUND', 'Template not found.', HttpStatus.NOT_FOUND);
    await this.db.client.messageTemplate.delete({ where: { id } });
    await this.auditLogs.record({ organisationId, userId, action: 'DELETE_MESSAGE_TEMPLATE', entityType: 'MessageTemplate', entityId: id, oldValues: { name: current.name } });
  }
}
