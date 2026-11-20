/**
 * The form of a phone number two records are compared on: digits only, country code first.
 * "+44 7700 900123", "0044 7700 900123" and "07700 900123" are all 447700900123.
 * Kept identical to the SQL in migration 20261105120000_job_skills_candidate_phone_dedup.
 * Returns null for anything that cannot be a phone number (fewer than 7 digits).
 */
export function normalizeCandidatePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (/^\s*\+/.test(raw)) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `44${digits.slice(1)}`;
  return digits;
}
