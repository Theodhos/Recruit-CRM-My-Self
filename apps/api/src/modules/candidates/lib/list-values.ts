/** "Electrician, Plumber\nGas safe" -> ['electrician', 'plumber', 'gas safe']: trimmed, lower-case, no blanks, no repeats. */
export function parseList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const parts = Array.isArray(value) ? value : String(value).split(/[,;\n]/);
  const clean = parts.map((part) => String(part).trim().toLowerCase()).filter(Boolean);
  return [...new Set(clean)].slice(0, 50);
}
