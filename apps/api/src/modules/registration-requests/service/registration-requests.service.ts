import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmailService } from '../../../infrastructure/email/email.service';
import { RegistrationRequestDto } from '../dto/registration-request.dto';

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

export interface RegistrationRequestResult {
  received: true;
  /** True once the message left the platform. False when no mail transport is configured or it refused the message. */
  notified: boolean;
}

/**
 * A visitor of the home page asks for an account. The details are e-mailed to the person who runs the platform
 * (REGISTRATION_NOTIFY_EMAIL, else ADMIN_EMAIL); the visitor's own address is the Reply-To, so answering the
 * e-mail answers the visitor. The request is never lost when mail is down: it is written to the log in full.
 */
@Injectable()
export class RegistrationRequestsService {
  private readonly logger = new Logger(RegistrationRequestsService.name);

  constructor(
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async submit(dto: RegistrationRequestDto): Promise<RegistrationRequestResult> {
    const to = this.config.get<string>('REGISTRATION_NOTIFY_EMAIL') || this.config.get<string>('ADMIN_EMAIL');
    const rows: [string, string][] = [
      ['Agency', dto.organisationName],
      ['Name', `${dto.firstName} ${dto.lastName}`],
      ['Email', dto.email],
      ['Phone', dto.phone ?? '—'],
      ['Message', dto.message ?? '—'],
    ];

    // always on record, whatever happens to the e-mail
    this.logger.log(`Access request: ${rows.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`);

    if (!to) {
      this.logger.warn('Access request not e-mailed: neither REGISTRATION_NOTIFY_EMAIL nor ADMIN_EMAIL is set.');
      return { received: true, notified: false };
    }

    const html =
      `<h2 style="margin:0 0 12px">New access request</h2>` +
      `<table cellpadding="6" style="border-collapse:collapse;border:1px solid #e5e7eb">` +
      rows.map(([k, v]) => `<tr><td style="font-weight:bold;border:1px solid #e5e7eb;vertical-align:top">${k}</td><td style="border:1px solid #e5e7eb">${escape(v).replace(/\n/g, '<br/>')}</td></tr>`).join('') +
      `</table><p style="color:#6b7280">Reply to this e-mail to answer ${escape(dto.firstName)} directly.</p>`;
    const text = `New access request\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nReply to this e-mail to answer ${dto.firstName} directly.`;

    // WhatsApp heads-up runs alongside the e-mail and never delays or fails the request
    void this.notifyWhatsApp(dto, to);

    try {
      const result = await this.email.send({
        to,
        subject: `New access request — ${dto.organisationName}`,
        html,
        text,
        replyTo: dto.email,
      });
      return { received: true, notified: result.delivered };
    } catch (error) {
      this.logger.error(`Access request could not be e-mailed to ${to}: ${error instanceof Error ? error.message : String(error)}`);
      return { received: true, notified: false };
    }
  }

  /**
   * Short WhatsApp message with a link to the inbox that holds the full details. Off unless configured:
   *  - WHATSAPP_PHONE + CALLMEBOT_API_KEY: sent through CallMeBot (free; the key comes from messaging their bot), or
   *  - WHATSAPP_WEBHOOK_URL: POSTed as {"text": "..."} to any automation (Make, Zapier, n8n, a Telegram/WhatsApp bridge).
   */
  private async notifyWhatsApp(dto: RegistrationRequestDto, to: string): Promise<void> {
    const phone = this.config.get<string>('WHATSAPP_PHONE');
    const apiKey = this.config.get<string>('CALLMEBOT_API_KEY');
    const webhook = this.config.get<string>('WHATSAPP_WEBHOOK_URL');
    if (!(phone && apiKey) && !webhook) return;

    const inbox = `https://mail.google.com/mail/u/${encodeURIComponent(to)}/#inbox`;
    const message =
      `Kerkese e re per llogari CRM\n` +
      `Agjencia: ${dto.organisationName}\n` +
      `Emri: ${dto.firstName} ${dto.lastName}\n` +
      `Email: ${dto.email}${dto.phone ? `\nTel: ${dto.phone}` : ''}\n` +
      `Detajet ne email: ${inbox}`;

    try {
      if (webhook) {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: message }),
          signal: AbortSignal.timeout(10_000),
        });
      } else {
        const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone ?? '')}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apiKey ?? '')}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) this.logger.warn(`WhatsApp notification refused (${response.status}).`);
      }
    } catch (error) {
      this.logger.warn(`WhatsApp notification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
