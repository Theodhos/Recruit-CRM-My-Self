import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../../common/exceptions/app.exception';
import { EmailService } from '../../../infrastructure/email/email.service';
import { ZoomService } from '../../../infrastructure/zoom/zoom.service';
import { CalendarService } from '../../calendar/service/calendar.service';
import { UsersService } from '../../users/service/users.service';
import type { CreateCandidateZoomDto } from '../dto/candidate-zoom.dto';

import { CandidatesService } from './candidates.service';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

function formatSlot(at: Date, timezone: string | null): string {
  try {
    return `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone ?? 'UTC' }).format(at)} (${timezone ?? 'UTC'})`;
  } catch {
    return `${at.toUTCString()} (UTC)`;
  }
}

export interface ZoomInviteDelivery {
  sent: boolean;
  to: string | null;
  error: string | null;
}

/**
 * A Zoom meeting for a candidate from the Stages view of /candidates (the Interview stage) — it needs no pipeline card.
 * The meeting is created through the Zoom API, put on the calendar and kept with the candidate (`stageData.INTERVIEW_1`),
 * and its invitation (date, time and link) is e-mailed on request or at once.
 */
@Injectable()
export class CandidateZoomService {
  private readonly logger = new Logger(CandidateZoomService.name);

  constructor(
    private readonly candidates: CandidatesService,
    private readonly zoom: ZoomService,
    private readonly email: EmailService,
    private readonly calendar: CalendarService,
    private readonly users: UsersService,
  ) {}

  async createMeeting(organisationId: string, userId: string, candidateId: string, dto: CreateCandidateZoomDto) {
    const candidate = await this.candidates.getById(organisationId, candidateId);
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new AppException('INVALID_DATE', 'scheduledAt is not a valid date', HttpStatus.BAD_REQUEST);
    }
    if (!this.zoom.isConfigured()) {
      throw new AppException(
        'ZOOM_NOT_CONNECTED',
        'Zoom is not connected on this platform yet — add ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET to the API environment so the meeting can be created.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const name = `${candidate.firstName} ${candidate.lastName}`.trim();
    const topic = `Interview: ${name}`;
    // hosted under the signed-in user's own Zoom account (their CRM e-mail), the platform's when they have none
    const host = await this.users.getById(organisationId, userId).catch(() => null);
    const meeting = await this.zoom.createMeeting({
      hostEmail: host?.email,
      topic,
      startTime: scheduledAt,
      durationMinutes: dto.durationMinutes,
      timezone: dto.timezone,
      agenda: dto.notes,
    });

    // on the calendar too; never fails the meeting
    try {
      await this.calendar.create(organisationId, userId, {
        title: topic,
        type: 'INTERVIEW',
        startAt: scheduledAt.toISOString(),
        endAt: new Date(scheduledAt.getTime() + dto.durationMinutes * 60_000).toISOString(),
        location: 'Zoom',
        meetingUrl: meeting.joinUrl,
        candidateId,
      });
    } catch (error) {
      this.logger.warn(`Zoom meeting for candidate ${candidateId} created but not put on the calendar: ${error}`);
    }

    await this.candidates.update(organisationId, userId, candidateId, {
      stageData: {
        INTERVIEW_1: {
          zoomUrl: meeting.joinUrl,
          zoomHostUrl: meeting.startUrl,
          zoomAt: scheduledAt.toISOString(),
          zoomDuration: String(dto.durationMinutes),
          zoomTimezone: dto.timezone ?? '',
          zoomNote: dto.notes?.trim() ?? '',
          zoomHostedBy: meeting.hostedBy,
          zoomInviteSentAt: '',
          zoomInviteTo: '',
          date: scheduledAt.toISOString().slice(0, 10),
        },
      },
    });

    const delivery = dto.sendInvite ? await this.sendInvite(organisationId, userId, candidateId) : null;
    return { meetingUrl: meeting.joinUrl, hostUrl: meeting.startUrl, hostedBy: meeting.hostedBy, email: delivery };
  }

  /** (Re)sends the invitation of the candidate's Zoom meeting: the date, the time and the link, to the address on file. */
  async sendInvite(organisationId: string, userId: string, candidateId: string): Promise<ZoomInviteDelivery> {
    const candidate = await this.candidates.getById(organisationId, candidateId);
    const data = (candidate.stageData as Record<string, Record<string, string>> | null)?.INTERVIEW_1;
    const to = candidate.email?.trim() || null;
    if (!data?.zoomUrl) return { sent: false, to, error: 'There is no Zoom meeting for this candidate yet.' };
    if (!to) return { sent: false, to: null, error: 'The candidate has no e-mail address on file.' };

    const host = await this.users.getById(organisationId, userId).catch(() => null);
    const hostName = host ? `${host.firstName} ${host.lastName}` : 'Our team';
    const timezone = data.zoomTimezone || null;
    const when = formatSlot(new Date(data.zoomAt ?? ''), timezone);
    const lines = [
      `Hello ${candidate.firstName},`,
      '',
      `${hostName} would like to meet you on Zoom.`,
      '',
      `When: ${when}`,
      `Duration: ${data.zoomDuration || '45'} minutes`,
      `Join Zoom meeting: ${data.zoomUrl}`,
      ...(data.zoomNote ? ['', data.zoomNote] : []),
      '',
      'If this time does not work for you, simply reply to this e-mail.',
    ];
    const html = `<p>${lines
      .map((line) => escapeHtml(line).replace(escapeHtml(data.zoomUrl!), `<a href="${escapeHtml(data.zoomUrl!)}">${escapeHtml(data.zoomUrl!)}</a>`))
      .join('<br/>')}</p>`;

    let delivery: ZoomInviteDelivery;
    try {
      const result = await this.email.send({ to, subject: 'Interview invitation', text: lines.join('\n'), html, replyTo: host?.email ?? undefined });
      delivery = result.delivered
        ? { sent: true, to, error: null }
        : { sent: false, to, error: 'E-mail sending is not configured on this platform (SMTP_HOST) — share the link with the candidate yourself.' };
    } catch (error) {
      this.logger.warn(`Zoom invitation for candidate ${candidateId} could not be sent to ${to}: ${error}`);
      delivery = { sent: false, to, error: `The e-mail could not be sent: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (delivery.sent) {
      await this.candidates.update(organisationId, userId, candidateId, {
        stageData: { INTERVIEW_1: { zoomInviteSentAt: new Date().toISOString(), zoomInviteTo: to } },
      });
    }
    return delivery;
  }
}
