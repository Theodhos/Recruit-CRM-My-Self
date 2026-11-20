import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type ContactPurpose = 'SMS' | 'EMAIL' | 'CALL';
export type ConsentValue = 'UNKNOWN' | 'GRANTED' | 'OPTED_OUT';

/** Why a candidate was left out of a contact list. */
export type ExclusionReason = 'DO_NOT_CONTACT' | 'OPTED_OUT' | 'NO_CONSENT' | 'NO_PHONE' | 'NO_EMAIL';

export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  DO_NOT_CONTACT: 'Marked "Do not use / do not contact"',
  OPTED_OUT: 'Opted out of this way of being contacted',
  NO_CONSENT: 'No consent recorded for this way of being contacted',
  NO_PHONE: 'No valid mobile number',
  NO_EMAIL: 'No e-mail address',
};

export interface PolicyCandidate {
  status: string;
  phone: string | null;
  email: string | null;
  smsConsent: ConsentValue;
  emailConsent: ConsentValue;
  callConsent: ConsentValue;
}

/**
 * Who may be put on a contact list, per way of being contacted. One place, used by every export and — later — by
 * bulk SMS, so no screen can quietly skip a rule:
 *  - "Do not contact" candidates are never on any list.
 *  - Sending SMS or e-mail marketing needs consent that was actually recorded (GRANTED). Nothing recorded counts as "no".
 *  - Exports pass requireConsent:false: there only an opt-out (or Do not use) keeps someone off the list. Sending a message always keeps the default.
 *  - A phone call needs only that the person did not opt out of calls.
 *  - An opt-out in a channel always wins over everything else.
 */
export function checkContactPolicy(candidate: PolicyCandidate, purpose: ContactPurpose, options: { requireConsent?: boolean } = {}): ExclusionReason | null {
  const requireConsent = options.requireConsent ?? true;
  if (candidate.status === 'DO_NOT_CONTACT') return 'DO_NOT_CONTACT';

  const consent = purpose === 'SMS' ? candidate.smsConsent : purpose === 'EMAIL' ? candidate.emailConsent : candidate.callConsent;
  if (consent === 'OPTED_OUT') return 'OPTED_OUT';
  if (requireConsent && purpose !== 'CALL' && consent !== 'GRANTED') return 'NO_CONSENT';

  if (purpose === 'EMAIL') return candidate.email?.trim() ? null : 'NO_EMAIL';
  return toE164(candidate.phone) ? null : 'NO_PHONE';
}

/** The phone number as +44…, or null when it cannot be a real number. A national number is read as UK unless it says otherwise. */
export function toE164(raw: string | null | undefined, defaultCountry: 'GB' = 'GB'): string | null {
  if (!raw?.trim()) return null;
  const parsed = parsePhoneNumberFromString(raw.trim(), defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}
