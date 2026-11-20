import * as XLSX from 'xlsx';

import { toE164 } from './contact-policy';
import { EXPORT_FIELDS, safeCell, type ExportFieldKey, type ExportRow } from './export-fields';

export type ExportFormat = 'CSV' | 'XLSX' | 'DIALPAD';

/**
 * Dialpad's "Shared company contacts" upload (Admin Settings > My Company > Shared Contacts): a CSV, UTF-8, header row
 * starting with First_Name / Last_Name, phone numbers in E.164 (+447700900123), at most 500 contacts per file.
 * The exact optional headers come from the template the Dialpad admin downloads; they are all listed here so a
 * difference is a one-line change.
 */
export const DIALPAD_MAX_CONTACTS = 500;
export const DIALPAD_COLUMNS = [
  { header: 'First_Name', value: (r: ExportRow) => r.firstName },
  { header: 'Last_Name', value: (r: ExportRow) => r.lastName },
  { header: 'Phone', value: (r: ExportRow) => toE164(r.phone) ?? '' },
  { header: 'Email', value: (r: ExportRow) => r.email ?? '' },
  { header: 'Company_Name', value: (r: ExportRow) => r.currentCompany ?? '' },
  { header: 'Job_Title', value: (r: ExportRow) => r.jobTitle ?? '' },
] as const;

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const toCsv = (header: string[], rows: (string | number)[][]) =>
  // the BOM makes Excel read the file as UTF-8 (names with accents)
  Buffer.from('﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n', 'utf8');

export interface BuiltFile {
  buffer: Buffer;
  contentType: string;
  extension: 'csv' | 'xlsx';
  rows: number;
}

export function buildExportFile(format: ExportFormat, rows: ExportRow[], fields: ExportFieldKey[]): BuiltFile {
  if (format === 'DIALPAD') {
    const body = rows.map((row) => DIALPAD_COLUMNS.map((column) => safeCell(column.value(row))));
    return { buffer: toCsv(DIALPAD_COLUMNS.map((c) => c.header), body), contentType: 'text/csv; charset=utf-8', extension: 'csv', rows: rows.length };
  }

  const header = fields.map((key) => EXPORT_FIELDS[key].label);
  const body = rows.map((row) => fields.map((key) => safeCell(EXPORT_FIELDS[key].value(row))));

  if (format === 'CSV') {
    return { buffer: toCsv(header, body), contentType: 'text/csv; charset=utf-8', extension: 'csv', rows: rows.length };
  }

  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  sheet['!cols'] = header.map((title) => ({ wch: Math.max(12, title.length + 2) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Candidates');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx', rows: rows.length };
}
