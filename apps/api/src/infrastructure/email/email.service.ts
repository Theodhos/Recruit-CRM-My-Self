import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  /** Where the recipient's reply should go (e.g. the instructor who sent an interview invitation). */
  replyTo?: string;
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** Tags and entities of a small HTML message turned into plain text (when a caller gave only HTML). */
const htmlToText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, (_m, href: string, label: string) => (label.trim() === href ? href : `${label} (${href})`))
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export interface SendEmailResult {
  /** False when no transport is configured — the message was only logged, nothing left the platform. */
  delivered: boolean;
  provider: 'smtp' | 'resend' | 'log';
  messageId: string | null;
}

/**
 * Thin wrapper around the configured EMAIL_PROVIDER (see .env.example). `smtp` sends through nodemailer, `resend`
 * sends through Resend's HTTPS API, and `log` only logs the message,
 * so a development box without a mail server never blocks a feature — callers get `delivered: false` and can tell
 * the user. Transport errors (unreachable host, refused login) are thrown for the caller to report.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  /** True when outbound mail can actually leave the platform. */
  isConfigured(): boolean {
    const provider = this.config.get<string>('EMAIL_PROVIDER', 'smtp');
    if (provider === 'resend') return Boolean(this.config.get<string>('RESEND_API_KEY') && this.config.get<string>('RESEND_FROM'));
    return provider !== 'log' && Boolean(this.config.get<string>('SMTP_HOST'));
  }

  /**
   * What mail filters look for in a message: a complete HTML document (not a fragment) next to a matching plain-text
   * part, a reply address that works (the no-reply sender address has no mailbox), and a footer saying who sent it.
   */
  private compose(input: SendEmailInput): Required<Pick<SendEmailInput, 'html' | 'text'>> & { replyTo?: string } {
    const body = input.html ?? `<p>${escape(input.text ?? '').replace(/\n/g, '<br/>')}</p>`;
    const org = this.config.get<string>('MAIL_SIGNATURE_NAME', 'Recruitment CRM');
    const site = (this.config.get<string>('WEB_URL') ?? '').replace(/\/$/, '');
    const footer = `This message was sent by ${org}${site ? ` (${site.replace(/^https?:\/\//, '')})` : ''} because of activity on your account.`;
    const html =
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      `<title>${escape(input.subject)}</title></head>` +
      '<body style="margin:0;padding:16px;background:#ffffff;color:#1f2937;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5">' +
      `<div style="max-width:560px">${body}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 8px"/>` +
      `<p style="color:#6b7280;font-size:12px;margin:0">${escape(footer)}</p></div></body></html>`;
    const text = `${input.text ?? htmlToText(body)}\n\n--\n${footer}`;
    return { html, text, replyTo: input.replyTo ?? (this.config.get<string>('EMAIL_REPLY_TO') || undefined) };
  }

  async send(rawInput: SendEmailInput): Promise<SendEmailResult> {
    const input = { ...rawInput, ...this.compose(rawInput) };
    const to = [input.to].flat();
    if (!this.isConfigured()) {
      this.logger.log(`[not delivered: e-mail transport not configured] -> ${to.join(', ')}: ${input.subject}`);
      return { delivered: false, provider: 'log', messageId: null };
    }

    if (this.config.get<string>('EMAIL_PROVIDER', 'smtp') === 'resend') {
      return this.sendWithResend({ ...input, to });
    }

    const info = await this.transport().sendMail({
      from: this.config.get<string>('SMTP_FROM') ?? this.config.get<string>('SMTP_USER'),
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    });
    this.logger.log(`Sent "${input.subject}" to ${to.join(', ')} (${info.messageId})`);
    return { delivered: true, provider: 'smtp', messageId: info.messageId ?? null };
  }

  private async sendWithResend(input: SendEmailInput & { to: string[] }): Promise<SendEmailResult> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.get<string>('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        // hosting dashboards sometimes keep the quotes of `RESEND_FROM="Name <a@b.c>"`, which Resend rejects as an invalid sender
        from: (this.config.get<string>('RESEND_FROM') ?? '').trim().replace(/^["']+|["']+$/g, ''),
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok) throw new Error(`Resend rejected the e-mail (${response.status}): ${data?.message ?? 'unknown error'}`);
    this.logger.log(`Sent "${input.subject}" to ${input.to.join(', ')} via Resend (${data?.id ?? 'no message id'})`);
    return { delivered: true, provider: 'resend', messageId: data?.id ?? null };
  }

  private transport(): Transporter {
    if (this.transporter) return this.transporter;
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    this.transporter = createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: user ? { user, pass: this.config.get<string>('SMTP_PASSWORD') } : undefined,
      // fail fast when the mail server is down instead of holding the request for minutes
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    return this.transporter;
  }
}
