/**
 * What a stage is called for the logic that depends on it. The Permanent pipeline's first three stages carry the
 * agency's own names — "Sent CV", "Interview 1", "Interview 2" — while the logic (their forms, colours, buttons) still
 * knows them by their role: new / screening / interview. Every other name is returned as it is, lower-cased.
 */
export function stageKey(name: string): string {
  const key = name.trim().toLowerCase();
  if (key === 'job applicants' || key === 'sent cv') return 'new';
  if (key === 'interview 1') return 'screening';
  if (key === 'interview 2') return 'interview';
  return key;
}
