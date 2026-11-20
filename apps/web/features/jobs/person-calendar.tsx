'use client';

import { Button, Dialog, Input, Label, Select } from '@crm/ui';
import type { JobSchedule } from '@crm/types';
import { ChevronLeft, ChevronRight } from '@crm/ui/icons';
import { useEffect, useRef, useState } from 'react';

type PeopleDays = NonNullable<JobSchedule['people']>;

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const hour = (time: string) => time.slice(0, 5);
// one colour for each candidate, the same in the legend and on the calendar
const PALETTE = ['#2d5a73', '#2f6b3b', '#b42318', '#7a3b6e', '#c2410c', '#3f7b88', '#b7791f', '#7a3b6e', '#2d5a73', '#5a7a2c'];
export interface CalendarCandidate {
  id: string;
  name: string;
}

/**
 * Left side of the edit panel of a Temporary job: a month calendar for one shift (turn) at a time. A click on a day opens a
 * small window to set the hours of that day (or take the day off); the × on a working day takes it off at once.
 * The days live in `schedule.people`, saved with the job.
 */
export function PersonCalendar({
  people,
  count,
  shifts,
  startDate,
  endDate,
  saving,
  onChange,
  onSave,
  candidates = [],
  assignments = {},
  onAssignmentsChange,
}: {
  people: PeopleDays;
  count: number;
  shifts: string[];
  startDate?: string;
  endDate?: string;
  saving: boolean;
  onChange: (next: PeopleDays) => void;
  /** Saves the days straight away (an existing job); a job still being added saves them with the job. */
  onSave?: () => void;
  /** The candidates working on the job: all of them are shown on the calendar, each in a colour of their own. */
  candidates?: CalendarCandidate[];
  /** candidate id → shift number */
  assignments?: Record<string, number>;
  onAssignmentsChange?: (next: Record<string, number>) => void;
}) {
  const today = new Date();
  const first = startDate ? new Date(`${startDate}T00:00:00`) : today;
  const [cursor, setCursor] = useState({ year: first.getFullYear(), month: first.getMonth() });
  // 0 = the overview with every candidate; 1… = the shift being edited
  const [person, setPerson] = useState(1);
  const overview = person === 0;
  const opened = useRef(false);
  useEffect(() => {
    if (candidates.length > 0 && !opened.current) {
      opened.current = true;
      setPerson(0);
    }
  }, [candidates.length]);
  const shiftOf = (candidateId: string, index: number) => Math.min(assignments[candidateId] ?? (index % Math.max(count, 1)) + 1, Math.max(count, 1));
  const effective = candidates.map((candidate, index) => [candidate.id, shiftOf(candidate.id, index)] as const);
  const unassigned = candidates.some((candidate) => !assignments[candidate.id]);
  useEffect(() => {
    // the shifts people get by default are kept, so the calendar shows the same on the next visit
    if (unassigned && onAssignmentsChange) onAssignmentsChange(Object.fromEntries(effective));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unassigned, candidates.length, count]);
  const [start, setStart] = useState('09:00');
  const [stop, setStop] = useState('17:00');

  const days = people[String(person)] ?? {};
  const daysOfShift = (shift: number) => people[String(shift)] ?? {};
  const setDays = (next: PeopleDays[string]) => onChange({ ...people, [String(person)]: next });
  const inRange = (date: string) => (!startDate || date >= startDate) && (!endDate || date <= endDate);

  // Days are ticked one by one (a click ticks / unticks); the hours are then set for all the ticked days together
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function choosePerson(number: number) {
    setPerson(number);
    setSelected(new Set());
  }
  function toggleDay(date: string) {
    if (!inRange(date)) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }
  const chosen = [...selected].sort();

  // the window where the hours of the ticked days are set
  const [editing, setEditing] = useState<{ start: string; stop: string; breakMinutes: string } | null>(null);
  const [breakMinutes, setBreakMinutes] = useState('');
  function openHours() {
    if (chosen.length === 0) return;
    // the hours the ticked days already share, otherwise the last ones given
    const shared = chosen.every((date) => days[date] && days[date]!.start === days[chosen[0]!]?.start && days[date]!.stop === days[chosen[0]!]?.stop) ? days[chosen[0]!] : undefined;
    setEditing({ start: shared?.start ?? start, stop: shared?.stop ?? stop, breakMinutes: shared ? (shared.breakMinutes ?? '') : breakMinutes });
  }
  function saveHours() {
    if (!editing) return;
    setDays({ ...days, ...Object.fromEntries(chosen.map((date) => [date, { start: editing.start, stop: editing.stop, ...(editing.breakMinutes ? { breakMinutes: editing.breakMinutes } : {}) }])) });
    setBreakMinutes(editing.breakMinutes);
    // the next days start with the hours just given
    setStart(editing.start);
    setStop(editing.stop);
    setSelected(new Set());
    setEditing(null);
  }
  function removeChosen() {
    const next = { ...days };
    for (const date of chosen) delete next[date];
    setDays(next);
    setSelected(new Set());
    setEditing(null);
  }

  const lead = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7;
  const length = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: length }, (_, index) => index + 1)];
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const move = (step: number) => {
    const date = new Date(cursor.year, cursor.month + step, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  };
  const marked = Object.keys(days).sort();

  return (
    <div className="flex flex-col gap-4 p-5" data-testid="person-calendar">
      <div>
        <h3 className="text-base font-semibold">Working days and hours</h3>
        <p className="mt-1 text-xs text-foreground/60">Choose a shift, tick the days (one or many), then press Set hours to give them all the same hours. The × on a working day takes it off.</p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Shift">
        {candidates.length > 0 ? (
          <button
            type="button"
            role="tab"
            aria-selected={overview}
            onClick={() => choosePerson(0)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${overview ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}
          >
            All candidates
            <span className="ml-1.5 text-xs opacity-70">{candidates.length}</span>
          </button>
        ) : null}
        {Array.from({ length: count }, (_, index) => index + 1).map((number) => (
          <button
            key={number}
            type="button"
            role="tab"
            aria-selected={person === number}
            title={shifts[number - 1] || undefined}
            onClick={() => choosePerson(number)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${person === number ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}
          >
            Shift {number}
            <span className="ml-1.5 text-xs opacity-70">{Object.keys(people[String(number)] ?? {}).length}d</span>
          </button>
        ))}
      </div>

      <div className="rounded-md border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Previous month" className="rounded-md p-1 hover:bg-accent" onClick={() => move(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold capitalize">{monthLabel}</span>
          <button type="button" aria-label="Next month" className="rounded-md p-1 hover:bg-accent" onClick={() => move(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-foreground/50">
          {WEEK.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            if (day === null) return <span key={`blank-${index}`} />;
            const date = iso(cursor.year, cursor.month, day);
            const hours = days[date];
            const allowed = inRange(date);
            if (overview) {
              // the preview: who works this day, in their own colour, with their hours
              const working = candidates.flatMap((candidate, index) => {
                const dayHours = daysOfShift(shiftOf(candidate.id, index))[date];
                return dayHours ? [{ candidate, index, hours: dayHours }] : [];
              });
              return (
                <div
                  key={date}
                  title={working.map((entry) => `${entry.candidate.name}: ${hour(entry.hours.start)}–${hour(entry.hours.stop)}${entry.hours.breakMinutes ? ` (break ${entry.hours.breakMinutes} min)` : ''}`).join('\n') || undefined}
                  className={`flex min-h-16 flex-col gap-0.5 rounded-md border p-0.5 text-[9px] leading-tight ${allowed ? 'border-border' : 'border-transparent text-foreground/25'}`}
                >
                  <span className="px-0.5 text-[11px] font-medium">{day}</span>
                  {working.slice(0, 3).map((entry) => (
                    <span key={entry.candidate.id} className="truncate rounded px-1 py-px text-white" style={{ backgroundColor: PALETTE[entry.index % PALETTE.length] }}>
                      {entry.candidate.name.split(' ')[0]} {hour(entry.hours.start)}–{hour(entry.hours.stop)}
                    </span>
                  ))}
                  {working.length > 3 ? <span className="px-1 text-foreground/60">+{working.length - 3} more</span> : null}
                </div>
              );
            }
            return (
              <div key={date} className="relative">
                <button
                  type="button"
                  disabled={!allowed}
                  aria-pressed={selected.has(date)}
                  onClick={() => toggleDay(date)}
                  className={`flex h-12 w-full flex-col items-center justify-center rounded-md border text-xs leading-tight transition-colors ${
                    (hours ? 'border-primary bg-primary text-primary-foreground' : '') + (selected.has(date) ? ' ring-2 ring-offset-1 ring-amber-400' : '') + (hours ? '' : allowed ? ' border-border hover:bg-accent' : ' cursor-not-allowed border-transparent text-foreground/25') }`}
                >
                  <span className="text-sm font-medium">{day}</span>
                  {hours ? <span className="text-[10px] opacity-90" title={hours.breakMinutes ? `Break ${hours.breakMinutes} min` : undefined}>{hour(hours.start)}–{hour(hours.stop)}</span> : null}
                </button>
                {hours ? (
                  // the × on top of a working day takes it off the calendar
                  <button
                    type="button"
                    aria-label={`Remove ${date}`}
                    title="Not working this day"
                    onClick={() => {
                      const next = { ...days };
                      delete next[date];
                      setDays(next);
                    }}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/90 text-[10px] font-bold leading-none text-foreground hover:bg-red-100 hover:text-red-700"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        {startDate || endDate ? (
          <p className="mt-2 text-[11px] text-foreground/50">Only days between {startDate || '…'} and {endDate || '…'} can be chosen.</p>
        ) : null}
      </div>

      {overview ? (
        <div className="flex flex-col gap-2" data-testid="calendar-legend">
          {effective.map(([candidateId, shift], index) => {
            const candidate = candidates[index]!;
            const worked = Object.values(daysOfShift(shift));
            const hourRanges = [...new Set(worked.map((entry) => `${hour(entry.start)}–${hour(entry.stop)}${entry.breakMinutes ? ` (break ${entry.breakMinutes} min)` : ''}`))];
            const totalHours = worked.reduce((sum, entry) => sum + hoursBetween(entry.start, entry.stop), 0).toFixed(1).replace(/.0$/, '');
            return (
              <div key={candidateId} className="flex flex-col gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: PALETTE[index % PALETTE.length] }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{candidate.name}</span>
                  <Select
                    aria-label={`Shift of ${candidate.name}`}
                    className="h-8 w-28 shrink-0 px-2 text-sm"
                    value={String(shift)}
                    onChange={(event) => onAssignmentsChange?.({ ...Object.fromEntries(effective), [candidateId]: Number(event.target.value) })}
                  >
                    {Array.from({ length: Math.max(count, 1) }, (_, option) => option + 1).map((option) => (
                      <option key={option} value={option}>Shift {option}</option>
                    ))}
                  </Select>
                </div>
                {/* the working hours of this candidate: each distinct start–stop with its break, then the totals */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 text-xs text-foreground/70">
                  {worked.length === 0 ? (
                    <span className="italic text-foreground/40">No working hours set for Shift {shift} yet</span>
                  ) : (
                    <>
                      {hourRanges.map((range) => (
                        <span key={range} className="rounded px-1.5 py-0.5 font-medium text-white" style={{ backgroundColor: PALETTE[index % PALETTE.length] }}>
                          {range}
                        </span>
                      ))}
                      <span>
                        {worked.length} day{worked.length === 1 ? '' : 's'} · {totalHours} h
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-xs text-foreground/50">Each candidate follows the days and hours of their shift. Choose a shift tab above to change them.</p>
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={chosen.length === 0} onClick={openHours}>
          Set hours{chosen.length > 0 ? ` for ${chosen.length} day${chosen.length === 1 ? '' : 's'}` : ''}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setSelected(new Set(cells.filter((day): day is number => day !== null).map((day) => iso(cursor.year, cursor.month, day)).filter(inRange)))}
        >
          Tick the whole month
        </Button>
        <Button type="button" variant="ghost" disabled={chosen.length === 0} onClick={() => setSelected(new Set())}>
          Untick
        </Button>
        <Button type="button" variant="ghost" disabled={marked.length === 0} onClick={() => setDays({})}>
          Clear all days
        </Button>
      </div>
      )}

      {!overview ? (
      <p className="text-sm text-foreground/70">
        Shift {person}: {marked.length} working day{marked.length === 1 ? '' : 's'}
        {marked.length > 0 ? ` · ${marked.reduce((sum, date) => sum + hoursBetween(days[date]!.start, days[date]!.stop), 0).toFixed(1).replace(/\.0$/, '')} hours` : ''}
      </p>
      ) : null}

      {onSave ? (
        <Button type="button" disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save calendar'}
        </Button>
      ) : (
        <p className="text-xs text-foreground/50">The days and hours are saved with the job when you press Create job.</p>
      )}

      {editing ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          title={
            chosen.length === 1
              ? `Shift ${person} · ${new Date(`${chosen[0]}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
              : `Shift ${person} · ${chosen.length} days`
          }
          description={chosen.length === 1 ? 'Set the hour this shift starts and finishes on this day.' : 'These hours are given to every ticked day.'}
          footer={
            <>
              {chosen.some((date) => days[date]) ? (
                <Button type="button" variant="ghost" className="mr-auto" onClick={removeChosen}>
                  Not working {chosen.length === 1 ? 'this day' : 'these days'}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={!editing.start || !editing.stop} onClick={saveHours}>
                {chosen.length === 1 ? 'Save day' : `Save ${chosen.length} days`}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="day-from">From</Label>
              <Input id="day-from" type="time" autoFocus value={editing.start} onChange={(event) => setEditing({ ...editing, start: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="day-to">To</Label>
              <Input id="day-to" type="time" value={editing.stop} onChange={(event) => setEditing({ ...editing, stop: event.target.value })} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="day-break">Break (min)</Label>
              <Input id="day-break" type="number" min={0} placeholder="e.g. 30" value={editing.breakMinutes} onChange={(event) => setEditing({ ...editing, breakMinutes: event.target.value })} />
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function hoursBetween(start: string, stop: string) {
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number);
  const [stopHour = 0, stopMinute = 0] = stop.split(':').map(Number);
  let minutes = stopHour * 60 + stopMinute - (startHour * 60 + startMinute);
  if (minutes < 0) minutes += 24 * 60; // a night shift ends the next morning
  return minutes / 60;
}
