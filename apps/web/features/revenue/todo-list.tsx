'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@crm/ui';
import { CheckCircle2, Undo2, X, type AppIcon } from '@crm/ui/icons';
import { useEffect, useState, type ReactNode } from 'react';

/** One group of a "To do" section (Fees, Retainers, Timesheets, Payroll, Commission): a step number, what to do, a line of help, its rows, and optionally one button for the whole group. */
export function TodoGroup({ step, icon: Icon, title, help, children, testId, actions }: { step: number; icon: AppIcon; title: string; help: string; children: ReactNode; testId?: string; actions?: ReactNode }) {
  return (
    <Card data-testid={testId} className="border-t-2 border-t-lime-500">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{step}</span>
            <Icon className="h-4 w-4 shrink-0 text-foreground/50" /> {title}
          </CardTitle>
          <p className="mt-0.5 text-sm text-foreground/60">{help}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent>
        {/* a fixed-height list: however many there are, the section keeps its size and scrolls inside */}
        <ul className="max-h-96 divide-y divide-border overflow-auto rounded-lg border border-border">{children}</ul>
      </CardContent>
    </Card>
  );
}

/** A row of a To do group: who it is about, a line of detail, an optional figure, and the button for the next step. */
export function TodoRow({ title, detail, action, aside }: { title: ReactNode; detail: ReactNode; action: ReactNode; aside?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent/30">
      <div className="min-w-0">
        {title}
        <p className="truncate text-xs text-foreground/55">{detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {aside}
        {action}
      </div>
    </li>
  );
}

/** "Nothing to do": shown in a To do section when every group is empty. */
export function NothingToDo({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      </span>
      <p className="text-sm font-semibold">Nothing to do</p>
      <p className="max-w-sm text-sm text-foreground/55">{text}</p>
      {action}
    </div>
  );
}

/**
 * The open section of a page, kept in the address (#todo, #all …). `initial` is the section shown until the person
 * chooses one (or the address names one).
 */
export function useSection<K extends string>(keys: readonly K[], initial: K) {
  const [section, setSection] = useState<K>(initial);
  const [chosen, setChosen] = useState(false);
  useEffect(() => {
    const fromAddress = window.location.hash.replace('#', '') as K;
    if (keys.includes(fromAddress)) {
      setSection(fromAddress);
      setChosen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once, when the page opens
  }, []);
  const open = (next: K) => {
    setSection(next);
    setChosen(true);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${next}`);
  };
  return { section, chosen, open };
}

/** The sections of a page as tabs, each with an optional count. */
export function SectionTabs<K extends string>({ sections, value, onChange, counts, label }: { sections: readonly { key: K; label: string; hint: string; icon: AppIcon }[]; value: K; onChange: (key: K) => void; counts?: Partial<Record<K, number | undefined>>; label: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-background p-1 shadow-sm" role="tablist" aria-label={label}>
      {sections.map(({ key, label: text, hint, icon: Icon }) => {
        const count = counts?.[key];
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={value === key}
            title={hint}
            onClick={() => onChange(key)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${value === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/70 hover:bg-accent'}`}
          >
            <Icon className="h-4 w-4" />
            {text}
            {count ? <span className={`rounded-full px-1.5 text-[11px] font-semibold ${value === key ? 'bg-primary-foreground/20' : 'bg-accent'}`}>{count}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

export interface Notice {
  tone: 'ok' | 'error';
  text: string;
  /** Puts back what was just done. */
  undo?: () => void;
  /** Another button in the message (e.g. "Mark as issued"). */
  extra?: { label: string; run: () => void };
}

/** A message that goes away by itself. */
export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.tone === 'error' ? 14_000 : notice.extra ? 30_000 : 9_000);
    return () => clearTimeout(timer);
  }, [notice]);
  return [notice, setNotice] as const;
}

/** What just happened, with a way back. */
export function NoticeBar({ notice, onClose, testId }: { notice: Notice | null; onClose: () => void; testId?: string }) {
  if (!notice) return null;
  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      data-testid={testId}
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm ${notice.tone === 'error' ? 'border-red-300 bg-red-50 text-red-800' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}
    >
      <span>{notice.text}</span>
      <span className="flex shrink-0 items-center gap-3">
        {notice.extra ? (
          <button type="button" onClick={notice.extra.run} className="font-semibold underline">
            {notice.extra.label}
          </button>
        ) : null}
        {notice.undo ? (
          <button type="button" onClick={notice.undo} className="inline-flex items-center gap-1 font-semibold underline">
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
        ) : null}
        <button type="button" aria-label="Close" onClick={onClose} className="text-current/60 hover:text-current">
          <X className="h-4 w-4" />
        </button>
      </span>
    </div>
  );
}
