import type { ReactNode } from 'react';

/**
 * The pieces the demos draw the platform's screens from. They copy the real ones — the same menu, the same buttons and
 * labels, the same colours of the stages — at the fixed size of the demo stage (960 × 540).
 */

const MENU = ['Dashboard', 'Pipeline Jobs', 'Pipeline Companies', 'Companies', 'Jobs', 'Candidates', 'Active Jobs Temporary', 'Completed Jobs', 'Active Employees', 'Rejected Applicants', 'Settings'];

export function MockApp({ active, title, action, children, dim }: { active: string; title: string; action?: ReactNode; children: ReactNode; dim?: boolean }) {
  return (
    <div className="absolute inset-0 flex bg-slate-50 text-slate-900">
      <aside className="flex w-[170px] shrink-0 flex-col gap-0.5 border-r border-slate-200 bg-white px-2 py-3">
        <p className="mb-2 px-2 text-[13px] font-bold">CRM</p>
        {MENU.map((item) => (
          <span key={item} className={`rounded-md px-2 py-1.5 text-[12px] ${item === active ? 'bg-slate-900 font-semibold text-white' : 'text-slate-600'}`}>
            {item}
          </span>
        ))}
      </aside>
      <main className={`relative flex-1 overflow-hidden px-5 py-4 ${dim ? 'opacity-60' : ''}`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
          <div className="flex gap-2">{action}</div>
        </div>
        {children}
      </main>
    </div>
  );
}

const TONES = {
  dark: 'bg-slate-900 text-white',
  outline: 'border border-slate-300 bg-white text-slate-900',
  amber: 'bg-amber-400 text-slate-950',
  red: 'bg-red-600 text-white',
  green: 'bg-emerald-600 text-white',
  purple: 'bg-violet-600 text-white',
  sky: 'bg-sky-500 text-white',
  grey: 'bg-slate-300 text-slate-500',
} as const;

export function Btn({ id, children, tone = 'dark', pulse, small }: { id?: string; children: ReactNode; tone?: keyof typeof TONES; pulse?: boolean; small?: boolean }) {
  return (
    <span data-demo={id} className={`inline-flex items-center rounded-md font-medium ${small ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]'} ${TONES[tone]} ${pulse ? 'demo-pulse' : ''}`}>
      {children}
    </span>
  );
}

export function Field({ id, label, value, wide, placeholder }: { id?: string; label: string; value?: string; wide?: boolean; placeholder?: string }) {
  return (
    <div data-demo={id} className={wide ? 'col-span-2' : ''}>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className={`flex h-8 items-center rounded-md border border-slate-300 bg-white px-2 text-[12px] ${value ? '' : 'text-slate-400'}`}>{value || placeholder || ''}</div>
    </div>
  );
}

export function Tag({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'navy' | 'violet' | 'sky' | 'green' | 'amber' | 'red' }) {
  const colour = { slate: 'bg-slate-200 text-slate-700', navy: 'bg-blue-900 text-white', violet: 'bg-violet-600 text-white', sky: 'bg-sky-500 text-white', green: 'bg-emerald-600 text-white', amber: 'bg-amber-400 text-slate-950', red: 'bg-red-600 text-white' }[tone];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${colour}`}>{children}</span>;
}

/** A table like the platform's lists: a header row and rows; the first row can be highlighted (the new one). */
export function Table({ head, rows, id, highlight, checks, checked = [] }: { head: string[]; rows: ReactNode[][]; id?: string; highlight?: number; checks?: boolean; checked?: number[] }) {
  return (
    <div data-demo={id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500" style={{ gridTemplateColumns: `${checks ? '20px ' : ''}repeat(${head.length}, minmax(0, 1fr))` }}>
        {checks ? <span /> : null}
        {head.map((cell) => (
          <span key={cell}>{cell}</span>
        ))}
      </div>
      {rows.map((row, r) => (
        <div key={r} data-demo={`row-${r}`} className={`grid items-center gap-2 border-b border-slate-100 px-3 py-2 text-[12px] last:border-0 ${highlight === r ? 'bg-emerald-50' : ''}`} style={{ gridTemplateColumns: `${checks ? '20px ' : ''}repeat(${head.length}, minmax(0, 1fr))` }}>
          {checks ? (
            <span data-demo={`check-${r}`} className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${checked.includes(r) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-400 bg-white'}`}>
              {checked.includes(r) ? '✓' : ''}
            </span>
          ) : null}
          {row.map((cell, c) => (
            <span key={c} className="truncate">
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Overlay({ children, side }: { children: ReactNode; side?: 'right' }) {
  return <div className={`absolute inset-0 z-20 flex bg-slate-900/45 ${side === 'right' ? 'justify-end' : 'items-center justify-center'}`}>{children}</div>;
}

export function Panel({ title, width = 520, children, drawer, footer }: { title: string; width?: number; children: ReactNode; drawer?: boolean; footer?: ReactNode }) {
  return (
    <div className={`flex flex-col bg-white shadow-2xl ${drawer ? 'h-full' : 'max-h-[500px] rounded-xl'}`} style={{ width }}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <p className="text-[15px] font-semibold">{title}</p>
        <span className="text-[16px] text-slate-400">✕</span>
      </div>
      <div className="flex-1 overflow-hidden px-4 py-3">{children}</div>
      {footer ? <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-900 px-4 py-3">{footer}</div> : null}
    </div>
  );
}

export function DropZone({ id, label = 'Drag and drop a document here', filled }: { id?: string; label?: string; filled?: string }) {
  return (
    <div data-demo={id} className={`mb-3 flex h-[70px] flex-col items-center justify-center rounded-lg border-2 border-dashed text-center ${filled ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide">{filled ? filled : label}</p>
      <p className="text-[10px] text-slate-500">{filled ? 'Filled 6 fields. Review before saving.' : 'or click to upload'}</p>
    </div>
  );
}

export const STAGE_TONE: Record<string, { bar: string; badge: string }> = {
  'Sent CV': { bar: 'bg-blue-900', badge: 'bg-blue-600' },
  'Interview 1': { bar: 'bg-violet-600', badge: 'bg-violet-600' },
  'Interview 2': { bar: 'bg-sky-500', badge: 'bg-sky-600' },
  Rejected: { bar: 'bg-red-600', badge: 'bg-red-600' },
  Placement: { bar: 'bg-emerald-600', badge: 'bg-emerald-700' },
  Completed: { bar: 'bg-slate-500', badge: 'bg-slate-600' },
  Screening: { bar: 'bg-violet-600', badge: 'bg-violet-600' },
  Active: { bar: 'bg-emerald-600', badge: 'bg-emerald-700' },
};

export function Column({ id, title, count, children, highlight, note }: { id?: string; title: string; count: number; children?: ReactNode; highlight?: boolean; note?: string }) {
  const tone = STAGE_TONE[title] ?? STAGE_TONE.Completed!;
  return (
    <div data-demo={id} className={`flex w-[150px] shrink-0 flex-col overflow-hidden rounded-lg border bg-white ${highlight ? 'border-blue-500 ring-2 ring-blue-300' : 'border-slate-200'}`}>
      <div className={`h-1.5 ${tone.bar}`} />
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-2">
        <span className="text-[12px] font-semibold">{title}</span>
        <span className={`rounded-full px-1.5 text-[10px] font-semibold text-white ${tone.badge}`}>{count}</span>
      </div>
      <div className="flex min-h-[200px] flex-col gap-1.5 p-1.5">
        {children}
        {count === 0 && !children ? <p className="px-1 py-6 text-center text-[10px] text-slate-400">{note ?? 'No applicants here'}</p> : null}
      </div>
    </div>
  );
}

export function PCard({ id, name, job = 'permanent job 2', tag, tone = 'navy', pulse }: { id?: string; name: string; job?: string; tag: string; tone?: 'navy' | 'violet' | 'sky' | 'green' | 'amber' | 'red'; pulse?: boolean }) {
  return (
    <div data-demo={id} className={`rounded-md border border-l-4 border-slate-200 bg-white p-2 shadow-sm ${tone === 'navy' ? 'border-l-blue-900' : tone === 'violet' ? 'border-l-violet-600' : tone === 'sky' ? 'border-l-sky-500' : tone === 'green' ? 'border-l-emerald-600' : tone === 'amber' ? 'border-l-amber-400' : 'border-l-red-600'} ${pulse ? 'demo-pulse' : ''}`}>
      <div className="flex items-start justify-between gap-1">
        <span className="text-[11px] font-semibold leading-tight">{name}</span>
        <Tag tone={tone}>{tag}</Tag>
      </div>
      <p className="mt-1 truncate text-[9px] text-slate-500">{job}</p>
    </div>
  );
}

export function Board({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 overflow-hidden">{children}</div>;
}

export function Toast({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'red' | 'amber' }) {
  const colour = { green: 'border-emerald-300 bg-emerald-50 text-emerald-900', red: 'border-red-300 bg-red-50 text-red-800', amber: 'border-amber-300 bg-amber-50 text-amber-900' }[tone];
  return <div className={`absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-lg border px-4 py-2 text-[12px] font-medium shadow-lg ${colour}`}>{children}</div>;
}

export function Notice({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <div className="w-[380px] rounded-xl bg-white px-6 pb-5 pt-6 text-center shadow-2xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-[22px] text-red-600">⚠</div>
      <p className="mt-3 text-[16px] font-semibold">{title}</p>
      <p className="mt-1.5 text-[12px] text-slate-500">{children}</p>
      <div data-demo={id} className="mt-4 rounded-md bg-red-500 py-2 text-[13px] font-semibold text-white">
        OK
      </div>
    </div>
  );
}
