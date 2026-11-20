import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../common/exceptions/app.exception';
import { ConnectionSettingsService, type ZoomCredentials } from '../connections/connection-settings.service';

export interface CreateZoomMeetingInput {
  topic: string;
  startTime: Date;
  durationMinutes: number;
  timezone?: string;
  agenda?: string;
  /** The Zoom account the meeting is hosted under: the user's own (their CRM e-mail). Falls back to the app owner's when that e-mail is not a Zoom user. */
  hostEmail?: string | null;
}

export interface ZoomMeeting {
  meetingId: string;
  /** For the participant (the candidate). */
  joinUrl: string;
  /** For the host — carries the host key, never sent to the candidate. */
  startUrl: string;
  password: string | null;
  /** Whose Zoom account hosts it: the user's own, or the platform's (app owner) when the user has none. */
  hostedBy: 'user' | 'account';
}

/**
 * Zoom meetings through a Server-to-Server OAuth app (ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET, scope
 * `meeting:write:admin` or `meeting:write`). Meetings are created under the app owner's Zoom user (`users/me`).
 * Unconfigured is a normal state: `isConfigured()` is false and callers fall back to a pasted meeting link.
 */
@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private token: { value: string; expiresAt: number; clientId: string } | null = null;

  constructor(private readonly settings: ConnectionSettingsService) {}

  isConfigured(): boolean {
    return this.settings.zoomCredentials() !== null;
  }

  /** Asks Zoom for a token with these credentials — used to check them before they are saved. Throws when Zoom refuses. */
  async verify(credentials: ZoomCredentials): Promise<void> {
    await this.requestToken(credentials);
  }

  async createMeeting(input: CreateZoomMeetingInput): Promise<ZoomMeeting> {
    const email = input.hostEmail?.trim();
    if (email) {
      const own = await this.post(email, input);
      // 404 = no Zoom user with that e-mail in the account: the meeting is made under the app owner instead
      if (own.ok) return this.read(own, 'user');
      if (own.status !== 404) await this.fail(own);
    }
    const shared = await this.post('me', input);
    if (!shared.ok) await this.fail(shared);
    return this.read(shared, 'account');
  }

  private async post(host: string, input: CreateZoomMeetingInput): Promise<Response> {
    return fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(host)}/meetings`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        topic: input.topic.slice(0, 200),
        type: 2, // scheduled meeting
        start_time: input.startTime.toISOString(),
        duration: input.durationMinutes,
        timezone: input.timezone,
        agenda: input.agenda?.slice(0, 2000),
        settings: { join_before_host: false, waiting_room: true, approval_type: 2, mute_upon_entry: true },
      }),
    });
  }

  private async fail(response: Response): Promise<never> {
    const body = await response.text().catch(() => '');
    this.logger.warn(`Zoom meeting creation failed (${response.status}): ${body.slice(0, 300)}`);
    throw new AppException('ZOOM_ERROR', `Zoom could not create the meeting (HTTP ${response.status})`, HttpStatus.BAD_GATEWAY);
  }

  private async read(response: Response, hostedBy: 'user' | 'account'): Promise<ZoomMeeting> {
    const meeting = (await response.json()) as { id: number | string; join_url: string; start_url: string; password?: string };
    return { meetingId: String(meeting.id), joinUrl: meeting.join_url, startUrl: meeting.start_url, password: meeting.password ?? null, hostedBy };
  }

  /** Account-credentials token, cached until a minute before it expires. */
  private async accessToken(): Promise<string> {
    const credentials = this.settings.zoomCredentials();
    if (!credentials) throw new AppException('ZOOM_NOT_CONNECTED', 'Zoom is not connected. An administrator can connect it in Settings → Connections.', HttpStatus.CONFLICT);
    if (this.token && this.token.expiresAt > Date.now() && this.token.clientId === credentials.clientId) return this.token.value;
    const json = await this.requestToken(credentials);
    this.token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000, clientId: credentials.clientId };
    return this.token.value;
  }

  private async requestToken(credentials: ZoomCredentials): Promise<{ access_token: string; expires_in: number }> {
    const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
    const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(credentials.accountId)}`, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}` },
    });
    if (!response.ok) {
      this.logger.warn(`Zoom OAuth token request failed (${response.status})`);
      throw new AppException('ZOOM_AUTH_ERROR', 'Zoom rejected these credentials — check the Account ID, Client ID and Client Secret of the Server-to-Server OAuth app.', HttpStatus.BAD_GATEWAY);
    }
    return (await response.json()) as { access_token: string; expires_in: number };
  }
}
