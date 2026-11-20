/**
 * The words of a search box. Every word must match somewhere in the row (each one against any of the columns), so
 * "electrician leeds" finds an Electrician job in Leeds and "ana kelmendi" the person with that full name.
 */
export function searchWords(raw?: string | null): string[] {
  return (raw ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
}

/** A typed phone number as the digits stored in E.164 (+44…): spaces and a leading 0 are dropped, so "07700 900123" finds +447700900123. Null when the word is not a number. */
export function phoneDigits(word: string): string | null {
  const compact = word.replace(/[\s().-]/g, '');
  if (!/^\+?\d{4,17}$/.test(compact)) return null;
  return compact.replace(/^\+/, '').replace(/^0+/, '');
}
