import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { EmailService } from '../../../infrastructure/email/email.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { UpdateOrganisationDto } from '../dto';
import { OrganisationsRepository } from '../repositories/organisations.repository';

export interface JobTitle {
  id: string;
  name: string;
}

export interface PayDefaults {
  currency: string;
  hoursPerDay: number;
  daysPerMonth: number;
  /** Null = no standard fee: it is typed per person. */
  feePercent: number | null;
  paymentTermDays: number;
}

const PAY_DEFAULTS: PayDefaults = { currency: 'GBP', hoursPerDay: 8, daysPerMonth: 21, feePercent: null, paymentTermDays: 30 };

function payDefaultsFrom(settings: unknown): PayDefaults {
  const saved = (settings && typeof settings === 'object' ? (settings as { payDefaults?: Partial<PayDefaults> }).payDefaults : undefined) ?? {};
  return {
    currency: typeof saved.currency === 'string' ? saved.currency : PAY_DEFAULTS.currency,
    hoursPerDay: typeof saved.hoursPerDay === 'number' ? saved.hoursPerDay : PAY_DEFAULTS.hoursPerDay,
    daysPerMonth: typeof saved.daysPerMonth === 'number' ? saved.daysPerMonth : PAY_DEFAULTS.daysPerMonth,
    feePercent: typeof saved.feePercent === 'number' ? saved.feePercent : PAY_DEFAULTS.feePercent,
    paymentTermDays: typeof saved.paymentTermDays === 'number' ? saved.paymentTermDays : PAY_DEFAULTS.paymentTermDays,
  };
}

/**
 * The organisation's own settings: its name, and the values the pay calculation and the fees start from (currency,
 * hours per day, days per month, fee %, days to pay). Kept in `Organisation.settings`.
 */
@Injectable()
export class OrganisationsService {
  constructor(
    private readonly repository: OrganisationsRepository,
    private readonly auditLogs: AuditLogsService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  private present(organisation: { id: string; name: string; slug: string; logoUrl: string | null; status: string; settings: unknown; createdAt: Date }) {
    const { settings, ...rest } = organisation;
    return { ...rest, payDefaults: payDefaultsFrom(settings) };
  }

  async current(organisationId: string) {
    const organisation = await this.repository.findById(organisationId);
    if (!organisation) throw new ResourceNotFoundException('Organisation', organisationId);
    return this.present(organisation);
  }

  async update(organisationId: string, userId: string, dto: UpdateOrganisationDto) {
    const existing = await this.repository.findById(organisationId);
    if (!existing) throw new ResourceNotFoundException('Organisation', organisationId);
    const settings = existing.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings) ? (existing.settings as Record<string, unknown>) : {};
    const payDefaults = dto.payDefaults
      ? { ...payDefaultsFrom(settings), ...dto.payDefaults, ...(dto.payDefaults.currency ? { currency: dto.payDefaults.currency.toUpperCase() } : {}) }
      : undefined;

    const organisation = await this.repository.update(organisationId, {
      ...(dto.name ? { name: dto.name.trim() } : {}),
      ...(payDefaults ? { settings: { ...settings, payDefaults } } : {}),
    });
    await this.auditLogs.record({ organisationId, userId, action: 'UPDATE_ORGANISATION', entityType: 'Organisation', entityId: organisationId, newValues: dto });
    return this.present(organisation);
  }

  // ---- Job titles: the list a job's title is chosen from (kept in Organisation.settings.jobTitles) -------------------

  private async titlesOf(organisationId: string): Promise<{ settings: Record<string, unknown>; titles: JobTitle[] }> {
    const organisation = await this.repository.findById(organisationId);
    if (!organisation) throw new ResourceNotFoundException('Organisation', organisationId);
    const settings = organisation.settings && typeof organisation.settings === 'object' && !Array.isArray(organisation.settings) ? (organisation.settings as Record<string, unknown>) : {};
    const saved = settings.jobTitles;
    if (Array.isArray(saved)) return { settings, titles: saved as JobTitle[] };
    // first time: the titles the jobs already carry become the list, so nothing that exists is left out of the choice
    const titles = (await this.repository.distinctJobTitles(organisationId)).map((name) => ({ id: randomUUID(), name }));
    if (titles.length > 0) await this.repository.update(organisationId, { settings: { ...settings, jobTitles: titles } as never });
    return { settings: { ...settings, jobTitles: titles }, titles };
  }

  private async saveTitles(organisationId: string, settings: Record<string, unknown>, titles: JobTitle[]): Promise<JobTitle[]> {
    const sorted = [...titles].sort((a, b) => a.name.localeCompare(b.name));
    await this.repository.update(organisationId, { settings: { ...settings, jobTitles: sorted } as never });
    return sorted;
  }

  async jobTitles(organisationId: string): Promise<JobTitle[]> {
    const { titles } = await this.titlesOf(organisationId);
    return [...titles].sort((a, b) => a.name.localeCompare(b.name));
  }

  async addJobTitle(organisationId: string, name: string): Promise<JobTitle[]> {
    const clean = name.trim();
    const { settings, titles } = await this.titlesOf(organisationId);
    if (titles.some((title) => title.name.toLowerCase() === clean.toLowerCase())) {
      throw new AppException('JOB_TITLE_EXISTS', `“${clean}” is already in the list.`, HttpStatus.CONFLICT);
    }
    return this.saveTitles(organisationId, settings, [...titles, { id: randomUUID(), name: clean }]);
  }

  async renameJobTitle(organisationId: string, id: string, name: string): Promise<JobTitle[]> {
    const clean = name.trim();
    const { settings, titles } = await this.titlesOf(organisationId);
    if (!titles.some((title) => title.id === id)) throw new ResourceNotFoundException('Job title', id);
    if (titles.some((title) => title.id !== id && title.name.toLowerCase() === clean.toLowerCase())) {
      throw new AppException('JOB_TITLE_EXISTS', `“${clean}” is already in the list.`, HttpStatus.CONFLICT);
    }
    return this.saveTitles(organisationId, settings, titles.map((title) => (title.id === id ? { ...title, name: clean } : title)));
  }

  async removeJobTitle(organisationId: string, id: string): Promise<JobTitle[]> {
    const { settings, titles } = await this.titlesOf(organisationId);
    return this.saveTitles(organisationId, settings, titles.filter((title) => title.id !== id));
  }

  /** What the platform is connected to — names only, never a key or a password. Read from the server's configuration. */
  integrations() {
    const has = (...keys: string[]) => keys.every((key) => Boolean(this.config.get<string>(key)));
    const storage = this.config.get<string>('STORAGE_PROVIDER', 's3');
    const emailProvider = this.config.get<string>('EMAIL_PROVIDER', 'smtp');
    const smtpHost = this.config.get<string>('SMTP_HOST') ?? '';
    // a test mailbox on this machine (MailHog, Mailpit…) catches the e-mails: nothing reaches a real address
    const smtpIsLocal = /^(localhost|127.0.0.1|mailhog|mailpit)$/i.test(smtpHost);
    const emailReady = this.email.isConfigured() && (emailProvider === 'resend' || !smtpIsLocal);
    const otpBySupabase = this.config.get('OTP_DELIVERY', 'smtp') === 'supabase' && has('SUPABASE_URL', 'SUPABASE_ANON_KEY');
    return [
      {
        key: 'email',
        name: emailProvider === 'resend' ? 'E-mail (Resend)' : 'E-mail (SMTP)',
        connected: emailReady,
        detail: emailReady
          ? emailProvider === 'resend' ? 'Sends through Resend.' : `Sends through ${smtpHost}`
          : smtpIsLocal
            ? `Points at a test mailbox on this machine (${smtpHost}): interview invitations and password reset links do not reach real addresses.`
            : 'Not set up: interview invitations and password reset links are not delivered.',
        needs: emailProvider === 'resend' ? ['RESEND_API_KEY', 'RESEND_FROM'] : ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'],
      },
      {
        key: 'loginCode',
        name: 'Login verification code',
        connected: otpBySupabase || emailReady,
        detail: otpBySupabase ? 'Sent and checked by Supabase Auth.' : emailReady ? `Sent by e-mail (${emailProvider}).` : 'No way to send it yet.',
        needs: otpBySupabase ? ['OTP_DELIVERY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'] : ['LOGIN_OTP_ENABLED', 'EMAIL_PROVIDER', 'RESEND_API_KEY', 'RESEND_FROM'],
      },
      {
        key: 'zoom',
        name: 'Zoom',
        connected: has('ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'),
        detail: has('ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET') ? 'Interview meetings are created automatically.' : 'Not connected: meetings cannot be created from the pipeline yet.',
        needs: ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
      },
      {
        key: 'telephony',
        name: 'Calls (Twilio)',
        connected: has('TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_TWIML_APP_SID', 'TWILIO_CALLER_ID'),
        detail: has('TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_TWIML_APP_SID', 'TWILIO_CALLER_ID')
          ? 'Calls are made from the browser.'
          : 'Not connected: Call opens the phone app instead.',
        needs: ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_TWIML_APP_SID', 'TWILIO_CALLER_ID'],
      },
      {
        key: 'storage',
        name: 'File storage',
        connected: storage !== 'local',
        detail: storage === 'local' ? 'Files are kept on this server’s disk — fine for one machine, not for production.' : `Files are kept in ${storage.toUpperCase()} storage (${this.config.get<string>('STORAGE_BUCKET') ?? 'bucket'}).`,
        needs: ['STORAGE_PROVIDER', 'STORAGE_ENDPOINT', 'STORAGE_BUCKET', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY'],
      },
    ];
  }
}
