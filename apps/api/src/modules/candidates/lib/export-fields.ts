import { toE164 } from './contact-policy';

/** What the export query reads from a candidate. Nothing else is ever selected, so nothing else can leak. */
export const EXPORT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  location: true,
  postalCode: true,
  jobTitle: true,
  trade: true,
  currentCompany: true,
  grade: true,
  employmentStatus: true,
  experienceYears: true,
  skills: true,
  qualifications: true,
  lastContactedAt: true,
  status: true,
  source: true,
  createdAt: true,
  smsConsent: true,
  emailConsent: true,
  callConsent: true,
} as const;

export interface ExportRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  postalCode: string | null;
  jobTitle: string | null;
  trade: string | null;
  currentCompany: string | null;
  grade: string | null;
  employmentStatus: string | null;
  experienceYears: number | null;
  skills: string[];
  qualifications: string[];
  lastContactedAt: Date | null;
  status: string;
  source: string | null;
  createdAt: Date;
  smsConsent: string;
  emailConsent: string;
  callConsent: string;
}

const date = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : '');
const label = (value: string | null) => (value ? value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '');

/** The columns a user may choose. The key is what the API accepts; the label is the heading in the file. */
export const EXPORT_FIELDS = {
  firstName: { label: 'First name', value: (r: ExportRow) => r.firstName },
  lastName: { label: 'Last name', value: (r: ExportRow) => r.lastName },
  mobile: { label: 'Mobile', value: (r: ExportRow) => toE164(r.phone) ?? r.phone ?? '' },
  email: { label: 'Email', value: (r: ExportRow) => r.email ?? '' },
  location: { label: 'Location', value: (r: ExportRow) => r.location ?? '' },
  postalCode: { label: 'Postcode', value: (r: ExportRow) => r.postalCode ?? '' },
  jobTitle: { label: 'Job title', value: (r: ExportRow) => r.jobTitle ?? '' },
  trade: { label: 'Trade', value: (r: ExportRow) => r.trade ?? '' },
  currentCompany: { label: 'Current employer', value: (r: ExportRow) => r.currentCompany ?? '' },
  grade: { label: 'Grade', value: (r: ExportRow) => r.grade ?? '' },
  employmentStatus: { label: 'Employment status', value: (r: ExportRow) => label(r.employmentStatus) },
  experienceYears: { label: 'Years of experience', value: (r: ExportRow) => (r.experienceYears ?? '') as string | number },
  skills: { label: 'Skills', value: (r: ExportRow) => r.skills.join('; ') },
  qualifications: { label: 'Qualifications', value: (r: ExportRow) => r.qualifications.join('; ') },
  lastContactedAt: { label: 'Last contacted', value: (r: ExportRow) => date(r.lastContactedAt) },
  status: { label: 'Status', value: (r: ExportRow) => label(r.status) },
  source: { label: 'Source', value: (r: ExportRow) => r.source ?? '' },
  addedOn: { label: 'Added on', value: (r: ExportRow) => date(r.createdAt) },
  smsConsent: { label: 'SMS consent', value: (r: ExportRow) => label(r.smsConsent) },
  emailConsent: { label: 'Email consent', value: (r: ExportRow) => label(r.emailConsent) },
} as const;

export type ExportFieldKey = keyof typeof EXPORT_FIELDS;
export const EXPORT_FIELD_KEYS = Object.keys(EXPORT_FIELDS) as ExportFieldKey[];

/** A spreadsheet runs a cell that starts with = + - @ as a formula. Prefixing a quote makes it plain text. */
export function safeCell(value: string | number): string | number {
  if (typeof value === 'number') return value;
  // a plain phone number (+447911123456) starts with + but is not a formula
  if (/^\+[0-9]{6,15}$/.test(value)) return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
