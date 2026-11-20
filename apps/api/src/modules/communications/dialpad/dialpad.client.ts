/**
 * Thin client for the Dialpad REST API (https://developers.dialpad.com). Only endpoints that appear in the official
 * reference are used:
 *   GET  /api/v2/company                        health / identity check
 *   GET  /api/v2/numbers                        company numbers (needs an admin-level key)
 *   GET  /api/v2/users?email=                   find the Dialpad user behind a CRM user
 *   POST /api/v2/sms                            send a text (from_number must be assigned to a user or user group)
 *   POST /api/v2/users/{id}/initiate_call       ring the user's Dialpad app and dial the number
 *   POST /api/v2/webhooks                       create the webhook that reports back (HS256-signed JWT)
 *   POST /api/v2/subscriptions/sms | /call      subscribe that webhook to text and call events
 * Authentication is `Authorization: Bearer <api key>`. The key never leaves the API process.
 */
export class DialpadError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Only set on HTTP 429: how long Dialpad asks us to wait. */
    readonly retryAfterMs?: number,
    readonly body?: unknown,
  ) {
    super(message);
  }

  get isRateLimit() {
    return this.status === 429;
  }
  get isAuth() {
    return this.status === 401 || this.status === 403;
  }
  /** Network failure / timeout / 5xx — worth retrying; a 4xx other than 429 is not. */
  get isTransient() {
    return this.status === 0 || this.status >= 500;
  }
}

export interface DialpadSms {
  id: string | number;
  message_status?: string;
  message_delivery_result?: string | null;
  from_number?: string;
  to_numbers?: string[];
  direction?: string;
}

export interface DialpadNumber {
  number: string;
  status?: string;
  type?: string;
  target_type?: string;
  target_id?: number | string;
}

export interface DialpadUser {
  id: number | string;
  display_name?: string;
  emails?: string[];
  state?: string;
  is_admin?: boolean;
  phone_numbers?: string[];
}

type FetchLike = typeof fetch;

export class DialpadClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://dialpad.com/api/v2',
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = 15_000,
  ) {}

  private async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new DialpadError(`Could not reach Dialpad (${(error as Error).name === 'TimeoutError' ? 'timed out' : 'network error'})`, 0);
    }

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = text;
    }
    if (response.ok) return parsed as T;

    const retryAfter = Number(response.headers.get('retry-after'));
    const detail = typeof parsed === 'object' && parsed !== null ? ((parsed as { error?: { message?: string }; message?: string }).error?.message ?? (parsed as { message?: string }).message) : undefined;
    throw new DialpadError(detail || `Dialpad answered ${response.status}`, response.status, response.status === 429 ? (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 15_000) : undefined, parsed);
  }

  company() {
    return this.request<{ id?: number | string; name?: string; domain?: string; account_type?: string }>('GET', '/company');
  }

  async numbers(): Promise<DialpadNumber[]> {
    const out: DialpadNumber[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const res = await this.request<{ items?: DialpadNumber[]; cursor?: string }>('GET', `/numbers${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
      out.push(...(res.items ?? []));
      cursor = res.cursor;
      if (!cursor) break;
    }
    return out;
  }

  async findUserByEmail(email: string): Promise<DialpadUser | null> {
    const res = await this.request<{ items?: DialpadUser[] }>('GET', `/users?email=${encodeURIComponent(email)}`);
    const wanted = email.toLowerCase();
    return (res.items ?? []).find((u) => u.emails?.some((e) => e.toLowerCase() === wanted)) ?? null;
  }

  sendSms(input: { to: string; text: string; fromNumber: string }) {
    return this.request<DialpadSms>('POST', '/sms', { to_numbers: [input.to], text: input.text, from_number: input.fromNumber });
  }

  initiateCall(userId: number | string, input: { phoneNumber: string; outboundCallerId: string; customData: string }) {
    return this.request<{ device?: { id?: string; type?: string } }>('POST', `/users/${encodeURIComponent(String(userId))}/initiate_call`, {
      phone_number: input.phoneNumber,
      outbound_caller_id: input.outboundCallerId,
      custom_data: input.customData,
    });
  }

  createWebhook(hookUrl: string, secret: string) {
    return this.request<{ id: number | string }>('POST', '/webhooks', { hook_url: hookUrl, secret });
  }

  /**
   * The reference names the webhook field `endpoint_id` in the request schema but "webhook_id" in the prose, so the
   * caller tries one and then the other (see DialpadConnectionService.subscribe).
   */
  subscribeSms(endpointField: 'endpoint_id' | 'webhook_id', webhookId: number | string) {
    return this.request<{ id: number | string }>('POST', '/subscriptions/sms', { direction: 'all', enabled: true, status: true, [endpointField]: Number(webhookId) });
  }

  subscribeCalls(endpointField: 'endpoint_id' | 'webhook_id', webhookId: number | string) {
    return this.request<{ id: number | string }>('POST', '/subscriptions/call', {
      call_states: ['ringing', 'connected', 'hangup', 'missed', 'voicemail'],
      enabled: true,
      [endpointField]: Number(webhookId),
    });
  }

  deleteSmsSubscription(id: number | string) {
    return this.request<unknown>('DELETE', `/subscriptions/sms/${encodeURIComponent(String(id))}`);
  }

  deleteCallSubscription(id: number | string) {
    return this.request<unknown>('DELETE', `/subscriptions/call/${encodeURIComponent(String(id))}`);
  }

  deleteWebhook(id: number | string) {
    return this.request<unknown>('DELETE', `/webhooks/${encodeURIComponent(String(id))}`);
  }
}
