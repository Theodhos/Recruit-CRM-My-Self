import { totalPages } from '@crm/utils';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { EmailService } from '../../../infrastructure/email/email.service';
import type { ListNotificationsQueryDto } from '../dto/list-notifications-query.dto';
import { NotificationsRepository } from '../repositories/notifications.repository';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repository: NotificationsRepository,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async list(organisationId: string, userId: string, query: ListNotificationsQueryDto) {
    const { items, totalItems } = await this.repository.findMany(organisationId, userId, query);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  unreadCount(organisationId: string, userId: string) {
    return this.repository.countUnread(organisationId, userId);
  }

  async markRead(organisationId: string, userId: string, id: string) {
    const notification = await this.repository.findById(organisationId, userId, id);
    if (!notification) throw new ResourceNotFoundException('Notification', id);
    return this.repository.markRead(organisationId, id);
  }

  markAllRead(organisationId: string, userId: string) {
    return this.repository.markAllRead(organisationId, userId);
  }

  async remove(organisationId: string, userId: string, id: string) {
    const notification = await this.repository.findById(organisationId, userId, id);
    if (!notification) throw new ResourceNotFoundException('Notification', id);
    await this.repository.delete(organisationId, id);
  }

  /**
   * A job or a candidate went from one recruiter to another: the notifications about it go with it (the new owner has them, with
   * their read marks), and a recruiter who now works it together with them gets a copy. Never throws: it must not fail the transfer.
   */
  async handOver(organisationId: string, fromUserId: string, toUserId: string, paths: string[], alsoUserIds: string[] = []): Promise<number> {
    if (fromUserId === toUserId) return 0;
    try {
      return await this.repository.handOver(organisationId, fromUserId, toUserId, alsoUserIds, paths);
    } catch (error) {
      this.logger.warn(`Could not hand the notifications over from ${fromUserId} to ${toUserId}: ${error}`);
      return 0;
    }
  }

  /**
   * The one entry point every other module calls to raise a notification —
   * see TasksService (task assigned) and PlacementsService (candidate
   * placed). Never throws: a notification failing to write should never
   * fail the business operation that triggered it.
   */
  async notify(
    organisationId: string,
    userId: string,
    data: { type: string; title: string; message?: string; link?: string },
  ): Promise<void> {
    try {
      await this.repository.create(organisationId, userId, data);
    } catch (error) {
      this.logger.warn(`Failed to create notification (${data.type}) for user ${userId}: ${error}`);
      return;
    }
    // The e-mail copy is not awaited: a slow or failing mail server must never delay or fail the operation.
    void this.emailCopy(organisationId, userId, data);
  }

  /** Same notification to the person's inbox (Resend over SMTP). Off with NOTIFICATION_EMAILS=false. */
  private async emailCopy(
    organisationId: string,
    userId: string,
    data: { type: string; title: string; message?: string; link?: string },
  ): Promise<void> {
    try {
      if (this.config.get<string>('NOTIFICATION_EMAILS', 'true') === 'false' || !this.email.isConfigured()) return;
      const to = await this.repository.findUserEmail(organisationId, userId);
      if (!to) return;

      const webUrl = (this.config.get<string>('WEB_URL') ?? this.config.get<string>('CORS_ORIGINS', '').split(',')[0] ?? '').replace(/\/$/, '');
      const url = data.link ? (data.link.startsWith('http') ? data.link : `${webUrl}${data.link}`) : webUrl;
      const text = [data.title, data.message, url].filter(Boolean).join('\n\n');
      const html =
        `<p><strong>${escapeHtml(data.title)}</strong></p>` +
        (data.message ? `<p>${escapeHtml(data.message).replace(/\n/g, '<br/>')}</p>` : '') +
        (url ? `<p><a href="${escapeHtml(url)}">Open in the CRM</a></p>` : '');
      await this.email.send({ to, subject: data.title, text, html });
    } catch (error) {
      this.logger.warn(`Failed to e-mail notification (${data.type}) to user ${userId}: ${error}`);
    }
  }
}
