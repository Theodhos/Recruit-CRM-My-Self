import type { ReactNode } from 'react';

/**
 * Flat, realistic product screens drawn in markup: hairline borders, real labels, real-looking rows.
 * No icons, no gradients. Nothing here talks to the API.
 */

const NAV = ['Dashboard', 'Pipeline Jobs', 'Companies', 'Candidates', 'Timesheets', 'Weekly payroll', 'Payslips', 'Commission', 'Settings'];

/** The tinted panel every illustration sits on, so all of them share one width and one height. */
export function Stage({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`flex items-center rounded-[8px] bg-[#ebe5d6] p-5 sm:p-8 ${wide ? '' : 'min-h-[560px]'}`}>
      <div className="w-full">{children}</div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2);
  return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] bg-[#e7e1d3] text-[10px] font-bold text-[#4a4538]">{initials}</span>;
}

function Shell({ active, title, action, sidebar = false, children }: { active?: string; title: string; action?: string; sidebar?: boolean; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[6px] border border-[#cfc8b8] bg-white text-[#141414] shadow-[0_1px_0_#cfc8b8,0_22px_36px_-22px_rgba(20,20,20,0.4)]">
      <div className="flex">
        {sidebar ? (
          <aside className="hidden w-40 shrink-0 border-r border-[#e7e1d3] bg-[#faf8f3] py-3 md:block">
            <div className="px-4 pb-3 text-[12px] font-bold tracking-tight text-[#141414]">Recruitment CRM</div>
            {NAV.map((n) => (
              <div
                key={n}
                className={`border-l-2 px-4 py-1.5 text-[12px] ${n === active ? 'border-[#c2410c] bg-white font-semibold text-[#141414]' : 'border-transparent text-[#6b6657]'}`}
              >
                {n}
              </div>
            ))}
          </aside>
        ) : null}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-[15px] font-bold tracking-tight text-[#141414]">{title}</h4>
            {action ? <span className="shrink-0 rounded-[3px] bg-[#141414] px-3 py-1.5 text-[12px] font-semibold text-white">{action}</span> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Table({ head, rows, widths }: { head: ReactNode[]; rows: ReactNode[][]; widths: string }) {
  return (
    <div className="border border-[#e7e1d3] text-[12.5px]">
      <div className={`grid ${widths} gap-2 bg-[#faf8f3] px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-[#8a846f]`}>
        {head.map((h, i) => <span key={i}>{h}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} className={`grid ${widths} items-center gap-2 border-t border-[#efe9db] px-3 py-2.5 text-[#2b2a25]`}>
          {r.map((c, j) => <span key={j} className="truncate">{c}</span>)}
        </div>
      ))}
    </div>
  );
}

function Person({ name }: { name: string }) {
  return <span className="flex items-center gap-2"><Avatar name={name} /> <b className="font-semibold">{name}</b></span>;
}

const Good = ({ children }: { children: ReactNode }) => <span className="font-semibold text-[#2f6b3b]">{children}</span>;
const Mute = ({ children }: { children: ReactNode }) => <span className="text-[#8a846f]">{children}</span>;
const Label = ({ children }: { children: ReactNode }) => <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#8a846f]">{children}</div>;

/* Hero ─ management dashboard (the only screen that shows the full app with its sidebar) */
export function HeroDashboard() {
  const weeks = [18, 26, 22, 34, 30, 41, 38, 52];
  return (
    <Shell active="Dashboard" title="Dashboard" sidebar>
      <div className="grid grid-cols-2 border border-[#e7e1d3] sm:grid-cols-4">
        {[['Placements', '24'], ['Revenue', '£48,210'], ['Open jobs', '37'], ['Interviews', '19']].map(([k, v], i) => (
          <div key={k} className={`px-4 py-3 ${i ? 'sm:border-l border-[#e7e1d3]' : ''} ${i > 1 ? 'border-t sm:border-t-0' : ''}`}>
            <Label>{k}</Label>
            <div className="mt-0.5 font-serif text-[24px] font-bold text-[#141414]">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="border border-[#e7e1d3] p-4">
          <div className="mb-3 flex justify-between"><Label>Revenue by week (£k)</Label><Label>November</Label></div>
          <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="h-32 w-full" role="img" aria-label="Revenue by week">
            {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2="400" y1={8 + i * 34} y2={8 + i * 34} stroke="#efe9db" />)}
            {weeks.map((w, i) => (
              <rect key={i} x={10 + i * 48} y={110 - w * 1.9} width="32" height={w * 1.9} fill={i === weeks.length - 1 ? '#c2410c' : '#141414'} />
            ))}
          </svg>
        </div>
        <div className="border border-[#e7e1d3] p-4">
          <Label>Pipeline</Label>
          <div className="mt-3 space-y-2.5">
            {[['Applied', 92], ['Interview', 58], ['Offer', 31], ['Placed', 24]].map(([n, w]) => (
              <div key={n} className="flex items-center gap-3 text-[12px] text-[#4a4538]">
                <span className="w-16">{n}</span>
                <div className="h-2 flex-1 bg-[#efe9db]"><div className="h-2 bg-[#141414]" style={{ width: `${w}%` }} /></div>
                <b className="w-6 text-right">{w}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Table
          widths="grid-cols-[1.3fr_1fr_.7fr]"
          head={['Latest placements', 'Client', 'Fee']}
          rows={[
            [<Person key="a" name="Ana Kelmendi" />, 'Acme Construction', '£9,000'],
            [<Person key="b" name="John Smith" />, 'Brook Ltd', '£3,420'],
            [<Person key="c" name="Maria Gjoni" />, 'Hale & Co', '£2,500'],
          ]}
        />
      </div>
    </Shell>
  );
}

/* Attract ─ careers site, then the application arriving in the CRM */
export function CareersSite() {
  return (
    <div className="rounded-[6px] border border-[#cfc8b8] bg-white p-5 shadow-[0_1px_0_#cfc8b8,0_22px_36px_-22px_rgba(20,20,20,0.4)]">
      <div className="flex items-baseline justify-between">
        <div className="font-serif text-[19px] font-bold text-[#141414]">Open roles</div>
        <Mute>Your careers site</Mute>
      </div>
      <div className="mt-3 divide-y divide-[#efe9db] text-[13px]">
        {[['Site Engineer', 'London', 'Permanent · £45–55k'], ['Electrician', 'Leeds', 'Temporary · £26/h'], ['Quantity Surveyor', 'Bristol', 'Permanent · £58k']].map(([t, l, p]) => (
          <div key={t} className="flex items-center justify-between py-3">
            <div><b className="text-[#141414]">{t}</b> <Mute>{l}</Mute><div className="text-[12px] text-[#6b6657]">{p}</div></div>
            <span className="font-semibold text-[#c2410c] underline underline-offset-4">Apply</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApplicationsTable() {
  return (
    <Shell title="Applications · today">
      <Table
        widths="grid-cols-[1.2fr_1fr_.9fr]"
        head={['Candidate', 'Applied for', 'Source']}
        rows={[
          [<Person key="a" name="Eda Berisha" />, 'Site Engineer', 'Careers site'],
          [<Person key="b" name="Luke Moore" />, 'Electrician', 'Careers site'],
          [<Person key="c" name="Tom Walsh" />, 'Site Engineer', 'Careers site'],
        ]}
      />
    </Shell>
  );
}

/* Capture ─ CV in, profile out */
export function CvMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-[6px] border-2 border-dashed border-[#c2410c]/60 bg-white px-5 py-4">
        <div className="flex h-12 w-10 shrink-0 flex-col justify-center gap-1 border border-[#cfc8b8] bg-[#faf8f3] px-1.5">
          {[100, 80, 90, 60].map((w, i) => <i key={i} className="block h-[3px] bg-[#cfc8b8]" style={{ width: `${w}%` }} />)}
        </div>
        <div>
          <div className="text-[14px] font-bold text-[#141414]">Ana_Kelmendi_CV.pdf</div>
          <div className="text-[12px] text-[#6b6657]">Dropped · read in a few seconds</div>
        </div>
        <span className="ml-auto text-[12px] font-bold uppercase tracking-wider text-[#c2410c]">Done</span>
      </div>
      <Shell title="New candidate" action="Create">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-[13px]">
          {[['First name', 'Ana'], ['Last name', 'Kelmendi'], ['Phone', '+44 7700 900123'], ['Location', 'London, UK'], ['Job title', 'Site Engineer'], ['Trade', 'Civil']].map(([k, v]) => (
            <div key={k}>
              <Label>{k}</Label>
              <div className="mt-1 border border-[#cfc8b8] px-2.5 py-1.5 font-medium text-[#141414]">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[12.5px]"><Good>No duplicate found</Good> <Mute>· ready to save</Mute></div>
      </Shell>
    </div>
  );
}

/* Clients */
export function ClientMock() {
  return (
    <Shell title="Acme Construction Ltd" action="Add job">
      <div className="mb-4 flex items-center justify-between border border-[#e7e1d3] px-4 py-3 text-[12.5px]">
        <span><Label>Industry</Label><b>Construction</b></span>
        <span><Label>Contact</Label><b>Sam Brooks</b></span>
        <span><Label>Status</Label><Good>Client</Good></span>
      </div>
      <div className="mb-3 flex gap-6 border-b border-[#e7e1d3] text-[13px]">
        {['Contacts', 'Jobs', 'Employees', 'Notes'].map((t) => (
          <span key={t} className={`pb-2 ${t === 'Jobs' ? 'border-b-2 border-[#c2410c] font-bold text-[#141414]' : 'text-[#8a846f]'}`}>{t}</span>
        ))}
      </div>
      <Table
        widths="grid-cols-[1.4fr_1fr_.7fr]"
        head={['Job', 'Candidates', 'Status']}
        rows={[
          ['Site Manager', '3 in pipeline', <Good key="1">Open</Good>],
          ['Electrician ×4', '6 in pipeline', <Good key="2">Open</Good>],
          ['Foreman', 'Hale placed', <Mute key="3">Filled</Mute>],
        ]}
      />
      <div className="mt-3 border border-[#e7e1d3] bg-[#faf8f3] px-3 py-2.5 text-[12.5px] text-[#4a4538]"><b>Last note · </b>Wants two more electricians from January.</div>
    </Shell>
  );
}

/* Pipeline */
export function BoardMock({ wide = false }: { wide?: boolean }) {
  const cols: [string, string[][]][] = [
    ['Applied', [['Ana K.', 'Site Engineer'], ['John S.', 'Electrician'], ['Rita D.', 'Surveyor'], ['Tom W.', 'Foreman']]],
    ['Interview', [['Maria G.', 'Project Manager'], ['Paul R.', 'Engineer'], ['Sara L.', 'Planner']]],
    ['Offer', [['Eda B.', 'Surveyor'], ['Luke M.', 'Foreman']]],
    ['Placed', [['Arben T.', 'Plumber'], ['Neil P.', 'Electrician']]],
  ];
  if (wide) cols.push(['Started', [['Joe H.', 'Labourer'], ['Gina F.', 'Planner'], ['Ravi S.', 'Engineer']]]);
  return (
    <Shell title="Site Engineer · London" action="Add candidate">
      <div className="mb-3 flex items-center justify-between border border-[#e7e1d3] px-4 py-2.5 text-[12.5px]">
        <span><Label>Client</Label><b>Acme Construction</b></span>
        <span><Label>Candidates</Label><b>11</b></span>
        <span><Label>Status</Label><Good>Open</Good></span>
      </div>
      <div className={`grid grid-cols-2 gap-2.5 ${wide ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
        {cols.map(([n, cards]) => (
          <div key={n} className="bg-[#faf8f3] p-2">
            <div className="mb-2 flex justify-between text-[10.5px] font-bold uppercase tracking-wider text-[#8a846f]"><span>{n}</span><span>{cards.length}</span></div>
            <div className="space-y-2">
              {cards.map(([a, b], i) => (
                <div key={a} className={`border bg-white p-2.5 ${n === 'Offer' && i === 0 ? 'border-[#c2410c] shadow-[0_6px_14px_-8px_rgba(194,65,12,0.6)]' : 'border-[#e7e1d3]'}`}>
                  <div className="text-[12.5px] font-semibold text-[#141414]">{a}</div>
                  <div className="truncate text-[11.5px] text-[#6b6657]">{b}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[12.5px] text-[#4a4538]"><b className="text-[#c2410c]">Offer</b> · Eda B. moves to <b>Placed</b> with one drag.</div>
    </Shell>
  );
}

/* Engage */
export function CommsMock() {
  const rows: [string, string, string][] = [
    ['09:12', 'Call · 4 min', 'Ana confirmed she can start Monday.'],
    ['09:20', 'WhatsApp', 'Interview details sent.'],
    ['09:41', 'SMS received', '“See you at 10.”'],
    ['Tue 10:30', 'Zoom interview', 'Invite sent. Reminder set for 10:00.'],
  ];
  return (
    <Shell title="Ana Kelmendi · Timeline">
      <div className="mb-4 flex gap-2 text-[12.5px] font-semibold">
        {['Call', 'SMS', 'WhatsApp', 'Zoom'].map((a, i) => (
          <span key={a} className={`px-3.5 py-1.5 ${i === 0 ? 'bg-[#141414] text-white' : 'border border-[#cfc8b8] text-[#4a4538]'}`}>{a}</span>
        ))}
      </div>
      <div className="border border-[#e7e1d3]">
        {rows.map(([t, k, d]) => (
          <div key={t} className="grid grid-cols-[72px_1fr] gap-3 border-b border-[#efe9db] px-3 py-3 last:border-0">
            <span className="text-[12px] text-[#8a846f]">{t}</span>
            <span className="text-[13px]"><b className="text-[#141414]">{k}</b><br /><span className="text-[#4a4538]">{d}</span></span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* Pay */
export function PayrollMock() {
  return (
    <Shell title="Weekly payroll · Week 46" action="Approve">
      <Table
        widths="grid-cols-[1.4fr_.5fr_.8fr_.8fr]"
        head={['Worker', 'Hours', 'Gross', 'Net']}
        rows={[
          [<Person key="a" name="John Smith" />, '42', '£1,092', <b key="n1">£873</b>],
          [<Person key="b" name="Arben Tafa" />, '40', '£960', <b key="n2">£768</b>],
          [<Person key="c" name="Luke Moore" />, '38', '£988', <b key="n3">£790</b>],
        ]}
      />
      <div className="mt-3 grid grid-cols-3 border border-[#e7e1d3]">
        {[['Timesheets', '41 approved'], ['Invoice · Acme', '£12,480 + VAT'], ['Payslips', 'Ready to send']].map(([a, b], i) => (
          <div key={a} className={`px-3 py-3 ${i ? 'border-l border-[#e7e1d3]' : ''}`}>
            <Label>{a}</Label>
            <div className="mt-0.5 text-[13px] font-semibold text-[#141414]">{b}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between border border-[#e7e1d3] bg-[#faf8f3] px-3 py-2.5 text-[12.5px]">
        <span className="text-[#4a4538]">Gross · CIS · VAT · Net all calculated</span>
        <b className="text-[#2f6b3b]">No re-typing</b>
      </div>
    </Shell>
  );
}

/* Earn */
export function MoneyMock() {
  return (
    <Shell title="Commission · November">
      <Table
        widths="grid-cols-[1.5fr_.8fr_.8fr_.9fr]"
        head={['Placement', 'Type', 'Fee', 'Commission']}
        rows={[
          ['Site Engineer · Acme', 'Perm', '£9,000', <b key="a">£2,700</b>],
          ['Electrician ×4 · Brook', 'Temp', '£3,420', <b key="b">£684</b>],
          ['Foreman · Hale & Co', 'Retainer', '£2,500', <b key="c">£500</b>],
        ]}
      />
      <div className="mt-3 flex items-end justify-between border border-[#e7e1d3] px-4 py-3">
        <div><Label>Your total</Label><div className="text-[12.5px] text-[#6b6657]">3 placements this month</div></div>
        <span className="font-serif text-[30px] font-bold leading-none text-[#141414]">£3,884</span>
      </div>
      <div className="mt-3 space-y-2">
        {[['Alex', 70, '£3,884'], ['Dion', 52, '£2,910'], ['Maria', 38, '£2,120']].map(([n, w, v]) => (
          <div key={n} className="flex items-center gap-3 text-[12.5px] text-[#4a4538]">
            <span className="w-12 font-semibold">{n}</span>
            <div className="h-2 flex-1 bg-[#efe9db]"><div className="h-2 bg-[#c2410c]" style={{ width: `${w}%` }} /></div>
            <b className="w-14 text-right">{v}</b>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* Control */
export function ControlMock() {
  const rows: [string, string[]][] = [
    ['Recruiter', ['●', '●', '–', '–']],
    ['Manager', ['●', '●', '●', '–']],
    ['Finance', ['–', '–', '●', '●']],
  ];
  return (
    <Shell title="Team access">
      <div className="mb-3 grid grid-cols-3 border border-[#e7e1d3]">
        {[['Revenue', '£48,210'], ['Pipeline', '£212k'], ['Placements', '24']].map(([k, v], i) => (
          <div key={k} className={`px-3 py-2.5 ${i ? 'border-l border-[#e7e1d3]' : ''}`}>
            <Label>{k}</Label>
            <div className="font-serif text-[20px] font-bold">{v}</div>
          </div>
        ))}
      </div>
      <Table
        widths="grid-cols-[1.1fr_repeat(4,.8fr)]"
        head={['Role', 'Candidates', 'Pipeline', 'Reports', 'Payroll']}
        rows={rows.map(([r, v]) => [<b key={r}>{r}</b>, ...v.map((x, i) => <span key={i} className={x === '●' ? 'text-[#c2410c]' : 'text-[#cfc8b8]'}>{x}</span>)])}
      />
      <div className="mt-3 border border-[#e7e1d3] text-[12.5px]">
        {[['Alex', 'moved Ana K. to Offer', '2 min'], ['Dion', 'approved 41 timesheets', '1 h'], ['Alex', 'exported candidate list', '3 h']].map(([u, a, t]) => (
          <div key={a} className="flex justify-between border-b border-[#efe9db] px-3 py-2 last:border-0"><span><b>{u}</b> {a}</span><Mute>{t}</Mute></div>
        ))}
      </div>
    </Shell>
  );
}
