/**
 * Date and time of a calendar event as written in notifications and their e-mail copies: the server runs in UTC, so
 * the time zone is named explicitly (APP_TIMEZONE, Europe/London by default) and shown after the time.
 */
export function formatEventWhen(at: Date): string {
  const timeZone = process.env.APP_TIMEZONE || 'Europe/London';
  try {
    return `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone }).format(at)} (${timeZone})`;
  } catch {
    return `${at.toUTCString()} (UTC)`;
  }
}
