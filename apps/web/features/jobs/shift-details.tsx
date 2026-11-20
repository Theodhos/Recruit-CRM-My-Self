'use client';

import { Input, Label, Select } from '@crm/ui';
import type { JobSchedule } from '@crm/types';
import { useEffect, useState } from 'react';

export const WEEKDAYS = [
  { key: 'mon', label: 'Monday', short: 'Mon' },
  { key: 'tue', label: 'Tuesday', short: 'Tue' },
  { key: 'wed', label: 'Wednesday', short: 'Wed' },
  { key: 'thu', label: 'Thursday', short: 'Thu' },
  { key: 'fri', label: 'Friday', short: 'Fri' },
  { key: 'sat', label: 'Saturday', short: 'Sat' },
  { key: 'sun', label: 'Sunday', short: 'Sun' },
] as const;

const GRID_ROWS = [
  { key: 'start', label: 'Time from', type: 'time' },
  { key: 'stop', label: 'Time out', type: 'time' },
  { key: 'breakMinutes', label: 'Break (min)', type: 'number' },
  { key: 'slots', label: 'Slots (open places)', type: 'number' },
] as const;

/** The shift most Temporary jobs have: Monday to Friday, 08:00 to 17:00, one hour of break. Filled in by default; changed only when a job differs. */
export const DEFAULT_SHIFT = { start: '08:00', stop: '17:00', breakMinutes: '60' } as const;
const DEFAULT_WORK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

/** Every Monday-to-Friday date from the start to the end date, each with the default hours: the first shift of the calendar. */
export function defaultShiftDays(startDate: string, endDate: string): Record<string, { start: string; stop: string; breakMinutes: string }> {
  const days: Record<string, { start: string; stop: string; breakMinutes: string }> = {};
  const from = new Date(`${startDate}T00:00:00`);
  const to = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return days;
  const cursor = new Date(from);
  for (let guard = 0; cursor <= to && guard < 400; guard += 1) {
    const weekday = cursor.getDay();
    if (weekday >= 1 && weekday <= 5) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      days[iso] = { ...DEFAULT_SHIFT };
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** The day columns of the shift table: Monday…Sunday for a weekly schedule, Day 1…Day N for a pattern. */
export function scheduleColumns(schedule: JobSchedule | null | undefined): { key: string; label: string }[] {
  if (schedule?.recurringType === 'PATTERN') {
    return Array.from({ length: schedule.patternDays ?? 0 }, (_, index) => ({ key: `day${index + 1}`, label: `Day ${index + 1}` }));
  }
  return WEEKDAYS.map((day) => ({ key: day.key, label: day.short }));
}

const PATTERN_ROWS = [
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'start', label: 'Start', type: 'time' },
  { key: 'stop', label: 'Stop', type: 'time' },
  { key: 'breakMinutes', label: 'Break (min)', type: 'number' },
  { key: 'shift', label: 'Shift', type: 'shift' },
] as const;
const PATTERN_STATUSES = ['Working', 'Day off'];
const PATTERN_SHIFTS = ['Morning', 'Afternoon', 'Night'];

/**
 * Pattern: the days of the pattern as columns (Day 1 … Day N) and Status, Start, Stop, Break and Shift as rows. Tick one
 * or more days at the top: whatever is changed in a ticked day is changed in all the ticked days together.
 */
function PatternTable({ schedule, onChange }: { schedule: JobSchedule; onChange: (next: JobSchedule) => void }) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const columns = scheduleColumns(schedule);
  if (columns.length === 0) {
    return <p className="text-sm italic text-foreground/40">Enter the pattern length to fill in each day.</p>;
  }
  const allTicked = columns.every((column) => ticked.has(column.key));
  const setCell = (column: string, row: string, cell: string) => {
    const targets = ticked.has(column) ? ticked : new Set([column]);
    const grid = { ...schedule.grid };
    for (const key of targets) grid[key] = { ...grid[key], [row]: cell };
    onChange({ ...schedule, grid });
  };
  const toggle = (key: string) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="overflow-x-auto" data-testid="pattern-table">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border bg-accent/40 px-2 py-1.5 text-left font-medium">
              <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-primary"
                  checked={allTicked}
                  onChange={(event) => setTicked(event.target.checked ? new Set(columns.map((column) => column.key)) : new Set())}
                />
                All days
              </label>
            </th>
            {columns.map((column) => (
              <th key={column.key} className={`border border-border px-2 py-1.5 text-center font-medium ${ticked.has(column.key) ? 'bg-primary/15' : 'bg-accent/40'}`}>
                <label className="flex cursor-pointer flex-col items-center gap-0.5 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" checked={ticked.has(column.key)} onChange={() => toggle(column.key)} />
                    {column.label}
                  </span>
                </label>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PATTERN_ROWS.map((row) => (
            <tr key={row.key}>
              <th className="whitespace-nowrap border border-border bg-accent/40 px-2 py-1.5 text-left font-medium">{row.label}</th>
              {columns.map((column) => {
                const cell = (schedule.grid?.[column.key] as Record<string, string | undefined> | undefined)?.[row.key] ?? '';
                return (
                  <td key={column.key} className={`border border-border p-1 ${ticked.has(column.key) ? 'bg-primary/5' : ''}`}>
                    {row.type === 'status' || row.type === 'shift' ? (
                      <Select
                        aria-label={`${row.label} ${column.label}`}
                        className="h-8 w-28 px-2 text-sm"
                        value={cell || (row.type === 'status' ? 'Working' : '')}
                        onChange={(event) => setCell(column.key, row.key, event.target.value)}
                      >
                        {row.type === 'shift' ? <option value="">—</option> : null}
                        {(row.type === 'status' ? PATTERN_STATUSES : PATTERN_SHIFTS).map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        aria-label={`${row.label} ${column.label}`}
                        type={row.type}
                        min={row.type === 'number' ? 0 : undefined}
                        className="h-8 w-28 px-2 text-sm"
                        value={cell}
                        onChange={(event) => setCell(column.key, row.key, event.target.value)}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Shifts": how many shifts (turns) the job runs — the calendar beside the form has one tab for each. */
function ShiftCountField({ schedule, onChange }: { schedule: JobSchedule; onChange: (next: JobSchedule) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="shiftCount">Shifts</Label>
      <Input
        id="shiftCount"
        type="number"
        min={1}
        max={10}
        placeholder="e.g. 3"
        className="h-9 w-24"
        value={schedule.shiftCount ?? ''}
        onChange={(event) => onChange({ ...schedule, shiftCount: event.target.value ? Math.min(10, Math.max(1, Math.round(Number(event.target.value)))) : undefined })}
      />
    </div>
  );
}

const timezones = (): string[] => {
  try {
    return (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone');
  } catch {
    return ['UTC'];
  }
};

/** Start / end date, timezone and "Shift details" (recurring type, the per-day table, the working weekdays) of a Temporary job. */
export function ShiftDetailsFields({
  value,
  onChange,
  errors,
  applyDefaults,
}: {
  value: JobSchedule | undefined;
  onChange: (next: JobSchedule) => void;
  /** A new job: the default shift (Monday to Friday, 08:00-17:00, 1 hour break) is filled in. */
  applyDefaults?: boolean;
  errors?: { dates?: string; timezone?: string; recurring?: string; workDays?: string };
}) {
  const schedule: JobSchedule = value ?? {};
  const set = (patch: Partial<JobSchedule>) => onChange({ ...schedule, ...patch });
  const workDays = schedule.workDays ?? [];
  // a Temporary job is Weekly unless Pattern is chosen
  // a Temporary job is Weekly unless Pattern is chosen, and the timezone is London unless another one is chosen; a new job also
  // starts with the usual shift already filled in: Monday to Friday, 08:00 - 17:00, 1 hour of break (all in one update, so
  // none of them overwrites another)
  useEffect(() => {
    const needsDefaults = Boolean(applyDefaults) && !value?.workDays?.length && !value?.grid;
    if (value?.recurringType && value?.timezone && !needsDefaults) return;
    onChange({
      ...(value ?? {}),
      recurringType: value?.recurringType ?? 'WEEKLY',
      timezone: value?.timezone || 'Europe/London',
      ...(needsDefaults ? { workDays: DEFAULT_WORK_DAYS, grid: Object.fromEntries(DEFAULT_WORK_DAYS.map((day) => [day, { ...DEFAULT_SHIFT }])) } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.recurringType, value?.timezone]);
  // Weekly has one line for the whole week: the value goes to every weekday column of the grid
  const setWeekly = (row: string, cell: string) =>
    set({ grid: Object.fromEntries(WEEKDAYS.map((day) => [day.key, { ...schedule.grid?.[day.key], [row]: cell }])) });

  return (
    <div className="flex flex-col gap-4 border-b border-border py-4" data-testid="shift-details">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Start date *</Label>
          <Input id="startDate" type="date" value={schedule.startDate ?? ''} onChange={(event) => set({ startDate: event.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endDate">End date *</Label>
          <Input id="endDate" type="date" value={schedule.endDate ?? ''} min={schedule.startDate || undefined} onChange={(event) => set({ endDate: event.target.value })} />
        </div>
        {errors?.dates ? <p className="col-span-2 text-xs text-red-600">{errors.dates}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timezone">Timezone *</Label>
        <Select id="timezone" value={schedule.timezone ?? 'Europe/London'} onChange={(event) => set({ timezone: event.target.value })}>
          <option value="">Choose a timezone</option>
          {timezones().map((zone) => (
            <option key={zone} value={zone}>{zone}</option>
          ))}
        </Select>
        {errors?.timezone ? <p className="text-xs text-red-600">{errors.timezone}</p> : null}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <div className="flex flex-col gap-1.5 sm:w-56">
          <Label htmlFor="recurringType">Recurring type *</Label>
          <Select
            id="recurringType"
            value={schedule.recurringType ?? 'WEEKLY'}
            onChange={(event) => {
              const recurringType = event.target.value as JobSchedule['recurringType'];
              set({ recurringType });
            }}
          >
            <option value="WEEKLY">Weekly</option>
            <option value="PATTERN">Pattern</option>
          </Select>
          {errors?.recurring ? <p className="text-xs text-red-600">{errors.recurring}</p> : null}
        </div>
        {(schedule.recurringType ?? 'WEEKLY') === 'WEEKLY' ? (
          // Weekly: one line — Time from, Time out, Break and Slots — the same for every day of the week
          <div className="flex flex-wrap items-end gap-3" data-testid="weekly-line">
            {GRID_ROWS.map((row) => (
              <div key={row.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`weekly-${row.key}`}>{row.label}</Label>
                <Input
                  id={`weekly-${row.key}`}
                  type={row.type}
                  min={row.type === 'number' ? 0 : undefined}
                  className="h-9 w-32"
                  value={schedule.grid?.mon?.[row.key] ?? ''}
                  onChange={(event) => setWeekly(row.key, event.target.value)}
                />
              </div>
            ))}
            <ShiftCountField schedule={schedule} onChange={onChange} />
          </div>
        ) : null}

        {schedule.recurringType === 'PATTERN' ? (
          // Pattern: one line — how long the pattern is, the slots and the shifts
          <div className="flex flex-wrap items-end gap-3" data-testid="pattern-line">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="patternDays">Pattern length (days)</Label>
              <Input
                id="patternDays"
                type="number"
                min={1}
                max={31}
                placeholder="1–31"
                className="h-9 w-32"
                value={schedule.patternDays ?? ''}
                onChange={(event) => set({ patternDays: event.target.value ? Math.min(31, Math.max(1, Number(event.target.value))) : undefined })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="patternSlots">Slots</Label>
              <Input id="patternSlots" type="number" min={0} className="h-9 w-28" value={schedule.slots ?? ''} onChange={(event) => set({ slots: event.target.value })} />
            </div>
            <ShiftCountField schedule={schedule} onChange={onChange} />
          </div>
        ) : null}

        {schedule.recurringType === 'PATTERN' ? <PatternTable schedule={schedule} onChange={onChange} /> : null}

        <div className="flex flex-col gap-1.5">
          <Label>Working days of each person *</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {WEEKDAYS.map((day) => (
              <label key={day.key} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-primary"
                  checked={workDays.includes(day.key)}
                  onChange={(event) => set({ workDays: event.target.checked ? [...workDays, day.key] : workDays.filter((key) => key !== day.key) })}
                />
                {day.short}
              </label>
            ))}
          </div>
          <p className="text-xs text-foreground/50">{workDays.length} working day{workDays.length === 1 ? '' : 's'} a week</p>
          {errors?.workDays ? <p className="text-xs text-red-600">{errors.workDays}</p> : null}
        </div>
      </div>
    </div>
  );
}

/** The saved start/end date, timezone and shift details of a Temporary job as a read-only table (second table of the edit panel). */
export function JobShiftTable({ schedule }: { schedule: JobSchedule | null | undefined }) {
  if (!schedule) {
    return (
      <div className="mb-4 rounded-md border border-border px-3 py-2 text-sm text-foreground/50" data-testid="job-shift-table">
        No shift details saved yet — fill them in below and press Save changes.
      </div>
    );
  }
  const columns = scheduleColumns(schedule);
  const workDays = WEEKDAYS.filter((day) => schedule.workDays?.includes(day.key));
  const span = columns.length + 1;
  return (
    <div className="mb-4 overflow-x-auto rounded-md border border-border text-sm" data-testid="job-shift-table">
      <table className="w-full min-w-max border-collapse">
        <tbody>
          <tr>
            <th className="w-48 bg-accent/40 px-3 py-2 text-left font-medium">Start date</th>
            <td className="px-3 py-2">{schedule.startDate || '—'}</td>
            <th className="bg-accent/40 px-3 py-2 text-left font-medium">End date</th>
            <td className="px-3 py-2" colSpan={Math.max(span - 2, 1)}>{schedule.endDate || '—'}</td>
          </tr>
          <tr className="border-t border-border">
            <th className="bg-accent/40 px-3 py-2 text-left font-medium">Timezone</th>
            <td className="px-3 py-2" colSpan={span}>{schedule.timezone || '—'}</td>
          </tr>
          <tr className="border-t border-border">
            <th className="bg-accent/40 px-3 py-2 text-left font-medium">Recurring type</th>
            <td className="px-3 py-2" colSpan={span}>
              {schedule.recurringType === 'PATTERN' ? `Pattern · ${schedule.patternDays ?? 0} days${schedule.slots ? ` · ${schedule.slots} slots` : ''}` : schedule.recurringType === 'WEEKLY' ? 'Weekly' : '—'}
            </td>
          </tr>
          <tr className="border-t border-border">
            <th className="bg-accent/40 px-3 py-2 text-left font-medium">Working days</th>
            <td className="px-3 py-2" colSpan={span}>
              {workDays.length > 0 ? `${workDays.map((day) => day.label).join(', ')} (${workDays.length} a week)` : '—'}
            </td>
          </tr>
          {columns.length > 0 ? (
            <>
              <tr className="border-t border-border bg-accent/40">
                <th className="px-3 py-2 text-left font-medium">Shift details</th>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-2 text-center font-medium">{column.label}</th>
                ))}
              </tr>
              {(schedule.recurringType === 'PATTERN' ? PATTERN_ROWS : GRID_ROWS).map((row) => (
                <tr key={row.key} className="border-t border-border">
                  <th className="bg-accent/40 px-3 py-2 text-left font-medium">{row.label}</th>
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-2 text-center">{(schedule.grid?.[column.key] as Record<string, string | undefined> | undefined)?.[row.key] || '—'}</td>
                  ))}
                </tr>
              ))}
            </>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
