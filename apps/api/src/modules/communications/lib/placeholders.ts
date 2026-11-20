/**
 * Placeholders a message template may use. One list, used by the editor (to show them), by validation (to refuse a
 * misspelt one before it is texted to 150 people) and by rendering.
 */
export const PLACEHOLDERS = [
  { key: 'firstName', label: 'First name', example: 'Jamie' },
  { key: 'lastName', label: 'Last name', example: 'Smith' },
  { key: 'fullName', label: 'Full name', example: 'Jamie Smith' },
  { key: 'jobTitle', label: 'Job title', example: 'Electrician' },
  { key: 'recruiterName', label: 'Your name', example: 'Alex from DC Solutions' },
] as const;

export type PlaceholderKey = (typeof PLACEHOLDERS)[number]['key'];
const KEYS = new Set<string>(PLACEHOLDERS.map((p) => p.key));
const TOKEN = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

/** The placeholders a text uses, and any that are not on the list. */
export function inspectTemplate(text: string): { used: PlaceholderKey[]; unknown: string[] } {
  const used = new Set<PlaceholderKey>();
  const unknown = new Set<string>();
  for (const match of text.matchAll(TOKEN)) {
    const key = match[1] as string;
    if (KEYS.has(key)) used.add(key as PlaceholderKey);
    else unknown.add(key);
  }
  return { used: [...used], unknown: [...unknown] };
}

export type PlaceholderValues = Partial<Record<PlaceholderKey, string | null | undefined>>;

/**
 * Fills a template. Returns the text, or the names of placeholders that have no value for this person — the caller
 * must not send a message that would read "Hi , we have a  job for you".
 */
export function renderTemplate(text: string, values: PlaceholderValues): { text: string } | { missing: PlaceholderKey[] } {
  const missing = new Set<PlaceholderKey>();
  const out = text.replace(TOKEN, (whole, key: string) => {
    if (!KEYS.has(key)) return whole;
    const value = values[key as PlaceholderKey]?.trim();
    if (!value) {
      missing.add(key as PlaceholderKey);
      return '';
    }
    return value;
  });
  return missing.size ? { missing: [...missing] } : { text: out };
}

/** Longest text we send as one message through the CRM (about four standard SMS segments). */
export const MAX_SMS_LENGTH = 612;

/** Stop words that a person texts back to leave a list (the keywords carriers and Dialpad treat as opt-outs). */
export function isOptOutText(text: string | null | undefined): boolean {
  return /^\s*(stop|stopall|unsubscribe|cancel|end|quit|opt\s*out)\s*[.!]?\s*$/i.test(text ?? '');
}
