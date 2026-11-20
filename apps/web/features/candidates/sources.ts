/** The only places a candidate can have come from. */
export const SOURCE_OPTIONS = ['LinkedIn', 'CV-Library', 'Indeed', 'WhatsApp', 'Web', 'Adzuna'] as const;

/** A stored source as one of SOURCE_OPTIONS ("Website" is the old name of "Web"); anything else counts as no source. */
export function normalizeSource(source: string | null | undefined): (typeof SOURCE_OPTIONS)[number] | null {
  const value = source === 'Website' ? 'Web' : source;
  return SOURCE_OPTIONS.find((option) => option === value) ?? null;
}
