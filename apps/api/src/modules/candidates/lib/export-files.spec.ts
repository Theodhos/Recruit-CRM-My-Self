import * as XLSX from 'xlsx';

import type { ExportRow } from './export-fields';
import { buildExportFile, DIALPAD_COLUMNS } from './export-files';

const row = (extra: Partial<ExportRow> = {}): ExportRow => ({
  id: 'c1',
  firstName: 'Ana',
  lastName: 'Kelmendi',
  email: 'ana@example.com',
  phone: '07911 123456',
  location: 'London',
  postalCode: 'SW1A 1AA',
  jobTitle: 'Electrician',
  trade: 'electrician',
  currentCompany: 'ACME, Ltd',
  grade: 'A',
  employmentStatus: 'SELF_EMPLOYED',
  experienceYears: 7,
  skills: ['conduit', 'fault finding'],
  qualifications: ['nvq 3'],
  lastContactedAt: new Date('2026-10-30T10:00:00Z'),
  status: 'ACTIVE',
  source: 'Web',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  smsConsent: 'GRANTED',
  emailConsent: 'GRANTED',
  callConsent: 'UNKNOWN',
  ...extra,
});

const text = (file: { buffer: Buffer }) => file.buffer.toString('utf8').replace(/^\ufeff/, '');

describe('CSV export', () => {
  it('writes exactly the chosen columns, in the chosen order, and nothing else', () => {
    const file = buildExportFile('CSV', [row()], ['lastName', 'firstName', 'mobile']);
    expect(text(file)).toBe('Last name,First name,Mobile\r\nKelmendi,Ana,+447911123456\r\n');
    expect(text(file)).not.toContain('ana@example.com');
    expect(text(file)).not.toContain('London');
  });

  it('starts with a byte-order mark so Excel opens accents correctly', () => {
    expect(buildExportFile('CSV', [row()], ['firstName']).buffer[0]).toBe(0xef);
  });

  it('quotes commas, quotes and line breaks', () => {
    const file = buildExportFile('CSV', [row({ currentCompany: 'ACME, "the best"\nLtd' })], ['currentCompany']);
    expect(text(file)).toBe('Current employer\r\n"ACME, ""the best""\nLtd"\r\n');
  });

  it('joins lists and formats dates and enums readably', () => {
    const file = buildExportFile('CSV', [row()], ['skills', 'qualifications', 'lastContactedAt', 'employmentStatus', 'grade', 'experienceYears']);
    expect(text(file)).toBe('Skills,Qualifications,Last contacted,Employment status,Grade,Years of experience\r\nconduit; fault finding,nvq 3,2026-10-30,Self employed,A,7\r\n');
  });

  it('neutralises spreadsheet formulas typed into a name', () => {
    const file = buildExportFile('CSV', [row({ firstName: '=HYPERLINK("http://evil")', lastName: '+1', jobTitle: '@SUM(A1)' })], ['firstName', 'lastName', 'jobTitle']);
    const cells = text(file).split('\r\n')[1]!;
    expect(cells.startsWith("\"'=HYPERLINK")).toBe(true);
    expect(cells).toContain("'+1");
    expect(cells).toContain("'@SUM(A1)");
  });

  it('a phone that cannot be normalised is written as it was stored (not dropped)', () => {
    expect(text(buildExportFile('CSV', [row({ phone: '0770 xx' })], ['mobile']))).toContain('0770 xx');
  });
});

describe('XLSX export', () => {
  it('is a real workbook with the chosen columns', () => {
    const file = buildExportFile('XLSX', [row(), row({ id: 'c2', firstName: 'Ben' })], ['firstName', 'email', 'experienceYears']);
    expect(file.extension).toBe('xlsx');
    const book = XLSX.read(file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets.Candidates!);
    expect(rows).toEqual([
      { 'First name': 'Ana', Email: 'ana@example.com', 'Years of experience': 7 },
      { 'First name': 'Ben', Email: 'ana@example.com', 'Years of experience': 7 },
    ]);
  });

  it('keeps numbers as numbers and neutralises formulas', () => {
    const file = buildExportFile('XLSX', [row({ firstName: '=1+1' })], ['firstName']);
    const sheet = XLSX.read(file.buffer, { type: 'buffer' }).Sheets.Candidates!;
    expect(sheet.A2!.v).toBe("'=1+1");
    expect(sheet.A2!.f).toBeUndefined();
  });
});

describe('Dialpad export', () => {
  it('uses the fixed contact layout with E.164 numbers, whatever fields were ticked', () => {
    const file = buildExportFile('DIALPAD', [row()], ['email']);
    const [header, line] = text(file).split('\r\n');
    expect(header).toBe(DIALPAD_COLUMNS.map((c) => c.header).join(','));
    expect(header!.startsWith('First_Name,Last_Name')).toBe(true);
    expect(line).toBe('Ana,Kelmendi,+447911123456,ana@example.com,"ACME, Ltd",Electrician');
  });
});
