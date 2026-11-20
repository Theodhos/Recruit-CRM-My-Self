/**
 * A UK phone number written the way it is dialled at home: "+44 7123 456789", "0044 7123 456789" and "447123456789" all become
 * "07123 456789". Anything that is not a UK-style number is only cleaned of stray characters, never rewritten.
 */
export function formatUkPhone(raw: string): string {
  let text = raw.replace(/\(0\)/g, '');
  const international = /^\s*(\+|00)\s*44/.test(text) || /^\s*44\d{10}\s*$/.test(text.replace(/[\s-]/g, ''));
  const plus = /^\s*\+/.test(text) && !international;
  text = text.replace(/[^\d]/g, '');
  if (international) text = '0' + text.replace(/^(00)?44/, '');
  if (!/^0\d*$/.test(text)) return plus ? `+${text}` : text;
  text = text.slice(0, 11);
  // 07123 456789
  return text.length > 5 ? `${text.slice(0, 5)} ${text.slice(5)}` : text;
}

/** What is typed in the Phone box: digits only (a "+" or letters are dropped), grouped as 07123 456789, at most 11 digits. */
export function typedUkPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

/** The message for a phone that cannot be accepted, or null when it is fine (or empty). */
export function phoneProblem(value: string | undefined, complete = false): string | null {
  const text = (value ?? '').trim();
  if (!text) return null;
  if (!/^07/.test(text.slice(0, 2)) && text.length >= 1 && !(text === '0')) return 'Must start with 07 (no +44)';
  if (complete && !/^07\d{3} \d{6}$/.test(text)) return 'Enter 11 digits, e.g. 07123 456789';
  return null;
}
