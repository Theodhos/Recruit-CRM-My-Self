'use client';

import { Badge, Button, Dialog, Input, Label } from '@crm/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Loader2 } from '@crm/ui/icons';
import { useState } from 'react';

/** One column the sheet may hold. `aliases` are the header names accepted for it (the table's own column names first). */
export interface ImportField {
  key: string;
  /** The header shown in the template and the preview. */
  label: string;
  aliases: string[];
  /** Turns the cell into the value the record stores; undefined = nothing usable in the cell. */
  parse?: (cell: unknown) => unknown;
}

export interface ExcelImportConfig {
  /** "companies", "candidates", "jobs" — used in the texts and the template's file name. */
  plural: string;
  fields: ImportField[];
  /** The fields a finished record has; a row missing any of them is still added, flagged "needs editing". */
  completeKeys: string[];
  /** What a row must have to be added at all (field keys). A row missing any of these is NOT added. */
  requiredKeys: string[];
  /** More fields a row must have depending on the row itself (e.g. a Temporary job needs its work dates). Field keys. */
  requiredFor?: (row: Record<string, unknown>) => string[];
  /** A short explanation per field for the instructions sheet of the template (allowed values, format). */
  notes?: Record<string, string>;
  /** Fields that are required only in some cases: what the instructions sheet says instead of "Required". */
  requiredNotes?: Record<string, string>;
  /** Groups of which at least one field must be filled, e.g. [['email', 'phone']]: a way to reach the person. */
  requiredOneOf?: string[][];
  /** The columns of the downloaded template, in this order (field keys). Left out: every field, in the order of `fields`. */
  templateKeys?: string[];
  /** A sample row for the template (by field key). */
  sample: Record<string, string>;
  /** Last touch on a row (splitting "Name" into first / last name, …). */
  finish?: (row: Record<string, unknown>) => Record<string, unknown>;
  /** The server-side rules for one record: values that break them are dropped from the row, the rest is kept. */
  validate: (row: Record<string, unknown>) => { success: boolean; error?: { issues: { path: PropertyKey[] }[] } };
  create: (row: Record<string, unknown>) => Promise<unknown>;
}

const norm = (text: unknown) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const text = (cell: unknown): string | undefined => {
  if (cell == null) return undefined;
  const value = cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell).trim();
  return value === '' ? undefined : value;
};

/** Cell parsers shared by the three sheets. */
export const parsers = {
  text,
  number: (cell: unknown) => {
    const value = Number(String(cell ?? '').replace(/[^0-9.-]/g, ''));
    return text(cell) === undefined || Number.isNaN(value) ? undefined : value;
  },
  date: (cell: unknown) => {
    const value = text(cell);
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
  },
  /** Matches the cell to one of the enum values, ignoring case, spaces and underscores ("Active Client" = ACTIVE_CLIENT). */
  oneOf: (values: string[], extra: Record<string, string> = {}) => (cell: unknown) => {
    const wanted = norm(cell);
    if (!wanted) return undefined;
    return values.find((value) => norm(value) === wanted) ?? extra[wanted];
  },
};

interface PreparedRow {
  line: number;
  values: Record<string, unknown>;
  dropped: string[];
  missing: string[];
  /** What is missing that matters: the row is not added. */
  blocked: string[];
}

const EXCEL_ACCEPT = '.xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
const isExcelFile = (file: File) => /\.(xlsx|xls|xlsm)$/i.test(file.name);

/**
 * Excel → a list (Companies, Candidates, Jobs). The columns are matched by their NAME (the same headers the table
 * shows), in any order; unknown columns are ignored. A row with only some of the details is still added — a value
 * that is not valid for its field is left empty — and is flagged so it can be opened and finished with Edit.
 * Nothing is written until "Import".
 */
export function ExcelImportDialog({ config, onClose }: { config: ExcelImportConfig; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PreparedRow[] | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [result, setResult] = useState<{ added: number; incomplete: number; skipped: number; failed: { line: number; message: string }[] } | null>(null);

  const labelOf = (key: string) => config.fields.find((field) => field.key === key)?.label ?? key;

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    // the columns of the table the sheet is imported into (a file made from the template imports straight back)
    const columns = (config.templateKeys ?? config.fields.map((field) => field.key)).map((key) => config.fields.find((field) => field.key === key)).filter((field): field is ImportField => Boolean(field));
    // a column that must be filled has a * after its name (the import ignores the *, so the headers still match)
    const mustFill = new Set([...config.requiredKeys, ...(config.requiredOneOf ?? []).flat()]);
    const headers = columns.map((field) => (mustFill.has(field.key) ? `${field.label} *` : field.label));
    const sheet = XLSX.utils.aoa_to_sheet([headers, columns.map((field) => config.sample[field.key] ?? '')]);
    sheet['!cols'] = headers.map((header) => ({ wch: Math.max(18, header.length + 4) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, config.plural);
    // a second sheet says which columns are required and what each one takes (the import only reads the first sheet)
    const help = XLSX.utils.aoa_to_sheet([
      ['Column', 'Required', 'What to write'],
      ...columns.map((field) => [field.label, config.requiredNotes?.[field.key] ?? (mustFill.has(field.key) ? 'Required' : 'Optional'), config.notes?.[field.key] ?? '']),
      [],
      ['* = the column must be filled in every row. A row that misses one of them is not added.'],
    ]);
    help['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, help, 'Instructions');
    XLSX.writeFile(workbook, `${config.plural}-template.xlsx`);
  }

  async function readFile() {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]!];
      const table = sheet ? (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][]) : [];
      const headerAt = table.findIndex((line) => line.some((cell) => text(cell) !== undefined));
      if (headerAt < 0) throw new Error('The sheet is empty.');

      // header name -> field
      const columns = new Map<number, ImportField>();
      const unknown: string[] = [];
      (table[headerAt] ?? []).forEach((cell, index) => {
        const name = text(cell);
        if (!name) return;
        const field = config.fields.find((candidate) => [candidate.label, ...candidate.aliases].some((alias) => norm(alias) === norm(name)));
        if (field && ![...columns.values()].includes(field)) columns.set(index, field);
        else unknown.push(name);
      });
      const accepted = config.fields.map((field) => field.label).join(', ');
      // every column must be one of the table's columns: a sheet that does not correspond adds nothing at all
      if (columns.size === 0) throw new Error(`No column of the file matches the ${config.plural} table, so nothing was added. Use these headers: ${accepted}.`);
      if (unknown.length > 0) {
        throw new Error(`These columns do not match the ${config.plural} table: ${unknown.join(', ')}. Nothing was added — rename or remove them and try again. Accepted headers: ${accepted}.`);
      }

      const prepared: PreparedRow[] = [];
      table.slice(headerAt + 1).forEach((line, offset) => {
        const values: Record<string, unknown> = {};
        for (const [index, field] of columns) {
          const value = (field.parse ?? parsers.text)(line[index]);
          if (value !== undefined && value !== '') values[field.key] = value;
        }
        if (Object.keys(values).length === 0) return; // an empty line
        let row = config.finish ? config.finish(values) : values;
        // values the server would refuse are left out so the rest of the row is still added
        const dropped: string[] = [];
        for (let attempt = 0; attempt < 6; attempt++) {
          const check = config.validate(row);
          if (check.success) break;
          const bad = new Set((check.error?.issues ?? []).map((issue) => String(issue.path[0] ?? '')));
          const next = Object.fromEntries(Object.entries(row).filter(([key]) => !bad.has(key)));
          bad.forEach((key) => key in row && dropped.push(labelOf(key)));
          if (Object.keys(next).length === Object.keys(row).length) break;
          row = next;
        }
        const missing = config.completeKeys.filter((key) => row[key] === undefined || row[key] === '').map(labelOf);
        const blocked = [
          ...[...config.requiredKeys, ...(config.requiredFor?.(row) ?? [])].filter((key) => row[key] === undefined || row[key] === '').map(labelOf),
          ...(config.requiredOneOf ?? []).filter((group) => group.every((key) => row[key] === undefined || row[key] === '')).map((group) => group.map(labelOf).join(' or ')),
        ];
        prepared.push({ line: headerAt + offset + 2, values: row, dropped, missing, blocked });
      });
      if (prepared.length === 0) throw new Error('No rows found under the header line.');
      setMatched([...columns.values()].map((field) => field.label));
      setIgnored(unknown);
      setRows(prepared);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file.');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    const failed: { line: number; message: string }[] = [];
    let added = 0;
    let incomplete = 0;
    // a few at a time: fast enough, and gentle on the server
    const queue = rows.filter((row) => row.blocked.length === 0);
    const skipped = rows.length - queue.length;
    const worker = async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        try {
          await config.create(row.values);
          added += 1;
          if (row.missing.length > 0 || row.dropped.length > 0) incomplete += 1;
        } catch (e) {
          failed.push({ line: row.line, message: e instanceof Error ? e.message : 'Not saved' });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    await queryClient.invalidateQueries();
    setResult({ added, incomplete, skipped, failed: failed.sort((a, b) => a.line - b.line) });
    setBusy(false);
  }

  const skippedCount = rows?.filter((row) => row.blocked.length > 0).length ?? 0;
  const addable = (rows?.length ?? 0) - skippedCount;
  const needEditing = rows?.filter((row) => row.blocked.length === 0 && (row.missing.length > 0 || row.dropped.length > 0)).length ?? 0;
  const previewKeys = config.fields.filter((field) => matched.includes(field.label)).slice(0, 5);

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()} title={`Import ${config.plural} from Excel`} className="max-h-[92vh] max-w-3xl overflow-y-auto">
      {result ? (
        <div className="flex flex-col gap-3" data-testid="import-result">
          <p className="text-sm">
            <b>{result.added}</b> {config.plural} added.
            {result.incomplete > 0 ? (
              <>
                {' '}
                <b>{result.incomplete}</b> of them have details missing — open them with Edit to finish.
              </>
            ) : null}
          </p>
          {result.skipped > 0 ? (
            <p className="text-sm text-amber-700">
              <b>{result.skipped}</b> rows were not added because an important detail is missing.
            </p>
          ) : null}
          {result.failed.length > 0 ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <p className="font-semibold">{result.failed.length} rows could not be saved:</p>
              <ul className="mt-1 max-h-40 list-disc overflow-auto pl-4">
                {result.failed.map((failure) => (
                  <li key={failure.line}>
                    Row {failure.line}: {failure.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : !rows ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground/60">
            Choose an Excel file (.xlsx). Columns are matched by their <b>name</b>, in any order, and every column must be one of these (a file with a column that does not match adds nothing): {config.fields.map((field) => field.label).join(', ')}. The columns
            marked <b>*</b> in the template must be filled in every row, otherwise the row is not added: {[...config.requiredKeys].map((key) => config.fields.find((field) => field.key === key)?.label ?? key).join(', ')}. The other details can be completed afterwards with Edit.
          </p>
          <button type="button" onClick={() => void downloadTemplate()} className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <Download className="h-4 w-4" /> Download the Excel template
          </button>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-excel-file">Excel file</Label>
            <Input
              id="import-excel-file"
              type="file"
              accept={EXCEL_ACCEPT}
              onChange={(event) => {
                const chosen = event.target.files?.[0] ?? null;
                if (chosen && !isExcelFile(chosen)) {
                  setError('Please choose an Excel file (.xlsx or .xls).');
                  setFile(null);
                  event.target.value = '';
                  return;
                }
                setError(null);
                setFile(chosen);
              }}
            />
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void readFile()} disabled={!file || busy}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1.5 h-4 w-4" />}
              {busy ? 'Reading…' : 'Preview'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-testid="import-preview">
          <div>
            <h3 className="text-sm font-semibold">{file?.name}</h3>
            <p className="text-xs text-foreground/50">
              Columns used: {matched.join(', ')}
              {ignored.length > 0 ? ` · ignored: ${ignored.join(', ')}` : ''}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-md bg-accent/40 p-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-foreground/50">Rows</dt>
              <dd className="font-semibold tabular-nums">{rows.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Complete</dt>
              <dd className="font-semibold tabular-nums">{addable - needEditing}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Need editing after</dt>
              <dd className="font-semibold tabular-nums">{needEditing}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Will not be added</dt>
              <dd className="font-semibold tabular-nums">{skippedCount}</dd>
            </div>
          </dl>
          <div className="max-h-64 overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-accent/60 text-left">
                <tr>
                  <th className="px-2 py-1.5">Row</th>
                  {previewKeys.map((field) => (
                    <th key={field.key} className="px-2 py-1.5">
                      {field.label}
                    </th>
                  ))}
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row) => (
                  <tr key={row.line} className="border-t border-border">
                    <td className="px-2 py-1 tabular-nums">{row.line}</td>
                    {previewKeys.map((field) => (
                      <td key={field.key} className="px-2 py-1">
                        {row.values[field.key] === undefined ? '—' : String(row.values[field.key])}
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      {row.blocked.length > 0 ? (
                        <Badge variant="destructive" title={`Missing: ${row.blocked.join(', ')}`}>
                          Not added — {row.blocked.join(', ')} missing
                        </Badge>
                      ) : row.missing.length === 0 && row.dropped.length === 0 ? (
                        <Badge variant="success">Complete</Badge>
                      ) : (
                        <Badge variant="warning" title={[row.missing.length ? `Missing: ${row.missing.join(', ')}` : '', row.dropped.length ? `Not valid, left empty: ${row.dropped.join(', ')}` : ''].filter(Boolean).join(' · ')}>
                          Needs editing
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 50 ? <p className="text-xs text-foreground/50">Showing the first 50 of {rows.length} rows.</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRows(null)} disabled={busy}>
              Back
            </Button>
            <Button type="button" onClick={() => void runImport()} disabled={busy || addable === 0}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {busy ? 'Importing…' : `Import ${addable} ${config.plural}`}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
