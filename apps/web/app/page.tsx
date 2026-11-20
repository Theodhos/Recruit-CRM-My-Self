import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  ApplicationsTable,
  BoardMock,
  CareersSite,
  ClientMock,
  CommsMock,
  ControlMock,
  CvMock,
  HeroDashboard,
  MoneyMock,
  PayrollMock,
  Stage,
} from '@/components/landing/mockups';

export const metadata: Metadata = {
  title: 'Recruitment CRM — From first CV to final payslip',
  description: 'One system to find, place, pay and earn. The CRM and ATS for recruitment and staffing agencies.',
};

const REGISTER = '/register';

/* ───────────────────────── content ───────────────────────── */

const ROUTE: Record<string, string> = {
  attract: 'Jobs go live. Applications arrive.',
  capture: 'CVs become profiles.',
  clients: 'One file per client.',
  pipeline: 'Every stage in view.',
  engage: 'Every contact logged.',
  pay: 'Payroll builds itself.',
  earn: 'Commission, exact.',
  control: 'The whole business, one screen.',
};

type Copy = { step: string; title: string; does: string; why: string };

const COPY: Record<string, Copy> = {
  attract: {
    step: 'Attract',
    title: 'Publish a job. Applications land in your CRM.',
    does: 'Publishes your jobs on your careers site and collects every application in the CRM.',
    why: 'Without it, applicants scatter across inboxes and job boards, and some are never seen.',
  },
  capture: {
    step: 'Capture',
    title: 'Drop a CV. The profile writes itself.',
    does: 'Reads each CV, fills in the candidate profile and flags duplicates.',
    why: 'Typing CVs takes hours and still leaves gaps and double entries.',
  },
  clients: {
    step: 'Clients',
    title: 'Every client, contact and job in one file.',
    does: 'Keeps every client, contact, job and note together in one record.',
    why: 'When client history lives in people’s heads, jobs get missed or promised twice.',
  },
  pipeline: {
    step: 'Pipeline',
    title: 'See every candidate at every stage.',
    does: 'Shows every candidate at every stage of every job, and moves them forward with a drag.',
    why: 'Without one shared view, nobody knows what is stuck or who needs chasing.',
  },
  engage: {
    step: 'Engage',
    title: 'Call, text, WhatsApp. It logs itself.',
    does: 'Calls, texts and messages candidates from their profile, and logs every contact.',
    why: 'Scattered conversations mean dropped follow-ups and lost placements.',
  },
  pay: {
    step: 'Pay',
    title: 'Timesheet in. Payslip out.',
    does: 'Turns approved timesheets into weekly payroll, client invoices and payslips.',
    why: 'Manual payroll is slow, and one wrong figure costs money and trust.',
  },
  earn: {
    step: 'Earn',
    title: 'Know what every placement earned.',
    does: 'Records the fee on every placement and works out each consultant’s commission.',
    why: 'Unclear commission causes disputes and slows the whole team down.',
  },
  control: {
    step: 'Control',
    title: 'Revenue, pipeline and team on one screen.',
    does: 'Shows revenue, pipeline and team activity, and limits what each person can see.',
    why: 'You cannot manage what you cannot see, and not everyone should see everything.',
  },
};

const ORDER = ['attract', 'capture', 'clients', 'pipeline', 'engage', 'pay', 'earn', 'control'] as const;

const ROLES = [
  { role: 'Recruiters', gain: 'Find, contact and place faster.', src: '/landing/recruiter.jpg', alt: 'A recruitment consultant' },
  { role: 'Managers', gain: 'See revenue and pipeline live.', src: '/landing/manager.jpg', alt: 'An agency manager' },
  { role: 'Finance', gain: 'Payroll and invoices without re-typing.', src: '/landing/finance.jpg', alt: 'A finance officer' },
  { role: 'Owners', gain: 'Control access. Trust the numbers.', src: '/landing/owner.jpg', alt: 'An agency owner' },
];

const COMPARE: [string, string][] = [
  ['Candidates in spreadsheets and inboxes', 'One searchable database'],
  ['Pipeline in someone’s head', 'Live stages for every job'],
  ['Calls and messages on personal phones', 'Every touch logged on the record'],
  ['Payroll rebuilt by hand each week', 'Generated from approved timesheets'],
  ['Commission worked out afterwards', 'Calculated per placement'],
  ['Numbers when someone has time', 'A dashboard, any day'],
];

const START = [
  ['Create your account', 'Your agency workspace is ready in a minute.'],
  ['Add your people', 'Drop in CVs and add your clients and jobs.'],
  ['Run your agency', 'Place, pay and track earnings in one place.'],
];

const FAQ: [string, string][] = [
  ['Who is it for?', 'Recruitment and staffing agencies placing permanent, temporary and contract workers.'],
  ['Do I install anything?', 'No. It runs in your browser.'],
  ['Can the whole team use it?', 'Yes. Set roles and choose which sections each person sees.'],
  ['Does it handle temporary worker payroll?', 'Yes. Timesheets become weekly payroll, client invoices and payslips.'],
  ['Can candidates apply from my website?', 'Yes. Your careers site lists open jobs and sends applications into the CRM.'],
  ['Is my data separate from other agencies?', 'Yes. Every organisation is isolated, and every action is audited.'],
];

/* ───────────────────────── pieces ───────────────────────── */

/** Every section uses this one container, so all content shares the same width and edges. */
function Wrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-6 ${className}`}>{children}</div>;
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <p className={`text-[13px] font-bold uppercase tracking-[0.16em] ${light ? 'text-[#f08a5d]' : 'text-[#c2410c]'}`}>{children}</p>;
}

function H2({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <h2 className={`mt-3 font-serif text-[2.1rem] font-bold leading-[1.05] tracking-tight sm:text-[3rem] ${light ? 'text-[#f6f3ec]' : 'text-[#141414]'}`}>{children}</h2>;
}

type Tone = 'paper' | 'dark' | 'accent';

function TryFree({ tone = 'paper', large = false, children = 'Try free' }: { tone?: Tone; large?: boolean; children?: ReactNode }) {
  const styles: Record<Tone, string> = {
    paper: 'bg-[#c2410c] text-white hover:bg-[#9a3412] focus-visible:ring-[#c2410c] focus-visible:ring-offset-[#f6f3ec]',
    dark: 'bg-[#c2410c] text-white hover:bg-[#e0541a] focus-visible:ring-white focus-visible:ring-offset-[#141414]',
    accent: 'bg-[#141414] text-white hover:bg-black focus-visible:ring-white focus-visible:ring-offset-[#c2410c]',
  };
  return (
    <Link
      href={REGISTER}
      className={`inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${large ? 'h-14 px-10 text-[17px]' : 'h-12 px-7 text-[15px]'} ${styles[tone]}`}
    >
      {children}
    </Link>
  );
}

/** The step number and name that opens every feature, tinted for the section behind it. */
function StepTag({ n, tone = 'paper' }: { n: number; tone?: Tone }) {
  const c = COPY[ORDER[n - 1]!]!;
  return (
    <div className="flex items-baseline gap-4">
      <span className={`font-serif text-[52px] font-bold leading-none ${tone === 'accent' ? 'text-[#141414]' : tone === 'dark' ? 'text-[#f08a5d]' : 'text-[#c2410c]'}`}>{String(n).padStart(2, '0')}</span>
      <span className={`text-[13px] font-bold uppercase tracking-[0.16em] ${tone === 'paper' ? 'text-[#6b6657]' : tone === 'accent' ? 'text-white/80' : 'text-[#bdb6a2]'}`}>{c.step}</span>
    </div>
  );
}

function Title({ id, tone = 'paper', className = '' }: { id: (typeof ORDER)[number]; tone?: Tone; className?: string }) {
  return (
    <h3 className={`font-serif text-[2.1rem] font-bold leading-[1.06] tracking-tight sm:text-[2.7rem] ${tone === 'paper' ? 'text-[#141414]' : 'text-white'} ${className}`}>
      {COPY[id]!.title}
    </h3>
  );
}

function DoesWhy({ id, tone = 'paper', stacked = false }: { id: (typeof ORDER)[number]; tone?: Tone; stacked?: boolean }) {
  const c = COPY[id]!;
  const line = tone === 'paper' ? 'border-[#d9d2c1]' : 'border-white/20';
  const label = tone === 'accent' ? 'text-[#141414]' : tone === 'dark' ? 'text-[#f08a5d]' : 'text-[#c2410c]';
  const first = tone === 'paper' ? 'text-[#141414]' : 'text-white';
  const second = tone === 'paper' ? 'text-[#4a4538]' : tone === 'accent' ? 'text-white/85' : 'text-[#bdb6a2]';
  return (
    <dl className={`border-t ${line}`}>
      {[
        ['What it does', c.does, first],
        ['Why you need it', c.why, second],
      ].map(([k, v, cls]) => (
        <div key={k} className={`grid gap-1 border-b py-5 ${stacked ? '' : 'sm:grid-cols-[150px_1fr] sm:gap-6'} ${line}`}>
          <dt className={`whitespace-nowrap pt-0.5 text-[12px] font-bold uppercase tracking-[0.1em] ${label}`}>{k}</dt>
          <dd className={`text-[17px] leading-snug ${cls}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One thing that goes wrong, drawn as the real object it lives in, with a caption underneath. */
function Pain({ children, caption, tilt }: { children: ReactNode; caption: string; tilt: string }) {
  return (
    <figure>
      <div className={`${tilt} transition-transform duration-300 hover:rotate-0`}>{children}</div>
      <figcaption className="mt-5 font-serif text-[23px] leading-tight text-[#f6f3ec]">{caption}</figcaption>
    </figure>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen scroll-smooth overflow-x-clip bg-[#f6f3ec] pb-16 text-[#141414] antialiased sm:pb-0">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-[#d9d2c1] bg-[#f6f3ec]/95 backdrop-blur">
        <Wrap className="flex h-16 items-center justify-between">
          <Link href="/" className="font-serif text-[20px] font-bold tracking-tight">Recruitment CRM</Link>
          <nav className="hidden items-center gap-9 text-[14px] font-medium text-[#4a4538] md:flex">
            <a href="#how" className="hover:text-[#141414]">How it works</a>
            <a href="#attract" className="hover:text-[#141414]">Features</a>
            <a href="#roles" className="hover:text-[#141414]">Who it’s for</a>
            <a href="#faq" className="hover:text-[#141414]">FAQ</a>
          </nav>
          <div className="flex items-center gap-5">
            <Link href={REGISTER} className="inline-flex h-10 items-center bg-[#c2410c] px-5 text-[14px] font-semibold text-white hover:bg-[#9a3412]">Try free</Link>
          </div>
        </Wrap>
      </header>

      {/* Hero */}
      <section className="pb-24 pt-16 lg:pt-24">
        <Wrap>
          <div className="grid items-end gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <Eyebrow>CRM and ATS for recruitment agencies</Eyebrow>
              <h1 className="mt-5 font-serif text-[2.9rem] font-bold leading-[1.02] tracking-[-0.02em] sm:text-[4.2rem]">
                From first CV to final payslip.
                <span className="block text-[#c2410c]">One system.</span>
              </h1>
            </div>
            <div className="lg:pb-2">
              <p className="max-w-md text-[19px] leading-snug text-[#4a4538]">
                Find, place, pay and earn without spreadsheets, lost CVs or Friday-night payroll.
              </p>
              <div className="mt-7"><TryFree large /></div>
            </div>
          </div>
          <div className="mt-14">
            <Stage wide>
              <HeroDashboard />
            </Stage>
          </div>
        </Wrap>
      </section>

      {/* Problem — a pile of the real things that go wrong */}
      <section className="bg-[#141414] py-24 text-[#f6f3ec]">
        <Wrap>
          <div className="grid items-end gap-8 lg:grid-cols-2 lg:gap-16">
            <div>
              <Eyebrow light>The problem</Eyebrow>
              <H2 light>Sound familiar?</H2>
            </div>
            <p className="max-w-md text-[19px] leading-snug text-[#bdb6a2] lg:pb-2">
              Your agency’s work is scattered across six places. Every one of them is a place something gets lost.
            </p>
          </div>

          <div className="mt-16 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1 inbox */}
            <Pain caption="CVs lost in inboxes" tilt="-rotate-2">
              <div className="border border-[#cfc8b8] bg-white text-[#141414]">
                <div className="flex justify-between border-b border-[#e7e1d3] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#8a846f]"><span>Inbox</span><span className="text-[#c2410c]">214 unread</span></div>
                {[['Re: CV – Site Engineer', true], ['Fwd: availability next week', true], ['Application (3 attachments)', false], ['CV attached', true]].map(([t, u]) => (
                  <div key={t as string} className="flex items-center gap-2 border-b border-[#efe9db] px-3 py-2 text-[12.5px] last:border-0">
                    <i className={`h-2 w-2 shrink-0 rounded-full ${u ? 'bg-[#c2410c]' : 'bg-[#cfc8b8]'}`} />
                    <span className={u ? 'font-bold' : 'text-[#6b6657]'}>{t as string}</span>
                  </div>
                ))}
              </div>
            </Pain>

            {/* 2 spreadsheet */}
            <Pain caption="Candidates in three spreadsheets" tilt="rotate-1">
              <div className="border border-[#cfc8b8] bg-white text-[#141414]">
                <div className="border-b border-[#e7e1d3] bg-[#eef3ec] px-3 py-1.5 text-[11.5px] font-semibold text-[#2f6b3b]">candidates_v3_FINAL(2).xlsx</div>
                <div className="grid grid-cols-[22px_1fr_1fr_1fr] text-[11.5px]">
                  {['', 'A', 'B', 'C'].map((h, i) => <span key={i} className="border-b border-r border-[#e7e1d3] bg-[#faf8f3] px-2 py-1 text-center text-[#8a846f]">{h}</span>)}
                  {[['1', 'Ana K.', '07700…', '???'], ['2', 'John S.', '', 'call'], ['3', 'Ana Kelmendi', '07700…', ''], ['4', 'M. Gjoni', '', '']].flatMap((r, ri) => r.map((c, ci) => (
                    <span key={`${ri}-${ci}`} className={`truncate border-b border-r border-[#efe9db] px-2 py-1.5 ${ci === 0 ? 'bg-[#faf8f3] text-center text-[#8a846f]' : ''}`}>{c}</span>
                  )))}
                </div>
              </div>
            </Pain>

            {/* 3 sticky note */}
            <Pain caption="Clients chased from memory" tilt="rotate-2">
              <div className="min-h-[150px] bg-[#f1e4a6] p-5 font-serif text-[20px] italic leading-snug text-[#3b3414] shadow-[0_14px_24px_-14px_rgba(0,0,0,0.7)]">
                Call Acme back??
                <br />Did Sam sign off the foreman?
                <br /><span className="text-[#a8412a]">Ask Dion…</span>
              </div>
            </Pain>

            {/* 4 paper timesheet */}
            <Pain caption="Timesheets on paper" tilt="rotate-1">
              <div className="border border-[#cfc8b8] bg-[#fbf9f2] p-4 text-[#2b2a25]">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-[#8a846f]"><span>Timesheet · wk 46</span><span>J. Smith</span></div>
                {[['Mon', '8'], ['Tue', '9'], ['Wed', '8.5 ?'], ['Thu', '—'], ['Fri', '9']].map(([d, h]) => (
                  <div key={d} className="mt-2 flex items-end justify-between border-b border-dashed border-[#bdb6a2] pb-0.5 font-serif text-[16px] italic">
                    <span className="not-italic text-[12.5px] text-[#6b6657]">{d}</span><span>{h}</span>
                  </div>
                ))}
                <div className="mt-3 text-right font-serif text-[15px] italic text-[#a8412a]">unsigned</div>
              </div>
            </Pain>

            {/* 5 calculator */}
            <Pain caption="Payroll on a calculator" tilt="-rotate-1">
              <div className="mx-auto w-[220px] border border-[#2b2a25] bg-[#2b2a25] p-3 shadow-[0_14px_24px_-14px_rgba(0,0,0,0.8)]">
                <div className="bg-[#cdd5b5] px-3 py-2 text-right font-mono text-[22px] text-[#1f2a14]">873.6</div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {['7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '=', 'C'].map((k) => (
                    <span key={k} className="flex h-8 items-center justify-center bg-[#4a4538] text-[13px] font-semibold text-[#f6f3ec]">{k}</span>
                  ))}
                </div>
              </div>
            </Pain>

            {/* 6 no idea */}
            <Pain caption="No idea what you earned this week" tilt="-rotate-2">
              <div className="border border-[#cfc8b8] bg-white p-5 text-[#141414]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#8a846f]">Earned this week</div>
                <div className="mt-2 font-serif text-[52px] font-bold leading-none text-[#c2410c]">£ ???</div>
                <div className="mt-3 text-[13px] text-[#6b6657]">“I’ll work it out on Monday.”</div>
              </div>
            </Pain>
          </div>

          <p className="mt-16 text-center font-serif text-[26px] text-[#e7e1d3] sm:text-[32px]">
            It is one problem. <span className="text-[#f08a5d]">Put it in one place.</span>
          </p>
        </Wrap>
      </section>

      {/* How it works — one route, from the first CV to the final payslip */}
      <section id="how" className="scroll-mt-16 py-24">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <H2>One route. Eight stops.</H2>
            <p className="mt-4 text-[18px] text-[#4a4538]">Eight steps in one record. Pick a stop to jump to it.</p>
          </div>

          <div className="relative mt-16">
            <div className="mb-8 hidden justify-between text-[12px] font-bold uppercase tracking-[0.16em] text-[#8a846f] lg:flex">
              <span>First CV</span>
              <span>Final payslip</span>
            </div>
            <div className="pointer-events-none absolute left-0 right-0 top-[69px] hidden h-px bg-[#c2410c]/40 lg:block" />
            <ol className="relative grid gap-0 lg:grid-cols-8 lg:gap-3">
              {ORDER.map((id, i) => (
                <li key={id} className="relative border-l-2 border-[#c2410c]/30 pb-8 pl-8 last:pb-0 lg:flex lg:flex-col lg:items-center lg:border-l-0 lg:pb-0 lg:pl-0 lg:text-center">
                  <a href={`#${id}`} className="group block lg:flex lg:flex-col lg:items-center">
                    <span className="absolute -left-[17px] top-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#c2410c] font-serif text-[14px] font-bold text-white transition-transform group-hover:scale-110 lg:static lg:h-11 lg:w-11 lg:text-[17px]">{i + 1}</span>
                    <span className={`hidden w-px bg-[#c2410c]/40 lg:block ${i % 2 === 0 ? 'h-8' : 'h-24'}`} />
                    <span className="block lg:mt-0">
                      <span className="block font-serif text-[24px] font-bold leading-none group-hover:text-[#c2410c]">{COPY[id]!.step}</span>
                      <span className="mt-2 block text-[14.5px] leading-snug text-[#6b6657]">{ROUTE[id]}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-16 flex justify-center"><TryFree large /></div>
        </Wrap>
      </section>

      {/* 01 Attract — centered, a flow from your site into the CRM */}
      <section id="attract" className="scroll-mt-16 border-t border-[#d9d2c1] py-24">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex justify-center"><StepTag n={1} /></div>
            <Title id="attract" className="mt-5" />
          </div>
          <div className="mt-14 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
            <CareersSite />
            <div className="flex flex-row items-center justify-center gap-3 text-[#c2410c] lg:flex-col">
              <span className="font-serif text-[40px] font-bold leading-none lg:rotate-0">→</span>
              <span className="max-w-[110px] text-center text-[11px] font-bold uppercase tracking-[0.14em]">Arrives in the CRM</span>
            </div>
            <ApplicationsTable />
          </div>
          <div className="mx-auto mt-14 grid max-w-4xl gap-x-12 md:grid-cols-2">
            {(['does', 'why'] as const).map((k) => (
              <div key={k} className="border-t border-[#d9d2c1] py-5">
                <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#c2410c]">{k === 'does' ? 'What it does' : 'Why you need it'}</div>
                <p className="mt-2 text-[17px] leading-snug text-[#141414]">{COPY.attract![k]}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* 02 Capture — dark, split, text left */}
      <section id="capture" className="scroll-mt-16 bg-[#141414] py-24 text-[#f6f3ec]">
        <Wrap>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <StepTag n={2} tone="dark" />
              <Title id="capture" tone="dark" className="mt-5" />
              <div className="mt-8"><DoesWhy id="capture" tone="dark" /></div>
              <div className="mt-8"><TryFree tone="dark">Try it on a real CV</TryFree></div>
            </div>
            <CvMock />
          </div>
        </Wrap>
      </section>

      {/* 03 Clients — sand, mock on the left */}
      <section id="clients" className="scroll-mt-16 bg-[#ebe5d6] py-24">
        <Wrap>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1"><ClientMock /></div>
            <div className="order-1 lg:order-2">
              <StepTag n={3} />
              <Title id="clients" className="mt-5" />
              <div className="mt-8"><DoesWhy id="clients" /></div>
              <div className="mt-8"><TryFree>Open your first client file</TryFree></div>
            </div>
          </div>
        </Wrap>
      </section>

      {/* 04 Pipeline — wide board across the full width */}
      <section id="pipeline" className="scroll-mt-16 py-24">
        <Wrap>
          <div className="grid items-end gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <StepTag n={4} />
              <Title id="pipeline" className="mt-5" />
            </div>
            <DoesWhy id="pipeline" />
          </div>
          <div className="mt-12">
            <Stage wide>
              <BoardMock wide />
            </Stage>
          </div>
        </Wrap>
      </section>

      {/* 05 Engage — dark, timeline on the left */}
      <section id="engage" className="scroll-mt-16 bg-[#141414] py-24 text-[#f6f3ec]">
        <Wrap>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1"><CommsMock /></div>
            <div className="order-1 lg:order-2">
              <StepTag n={5} tone="dark" />
              <Title id="engage" tone="dark" className="mt-5" />
              <div className="mt-8"><DoesWhy id="engage" tone="dark" /></div>
              <div className="mt-8"><TryFree tone="dark">Message your first candidate</TryFree></div>
            </div>
          </div>
        </Wrap>
      </section>

      {/* 06 Pay — the accent colour, the payoff */}
      <section id="pay" className="scroll-mt-16 bg-[#c2410c] py-24 text-white">
        <Wrap>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <StepTag n={6} tone="accent" />
              <Title id="pay" tone="accent" className="mt-5" />
              <div className="mt-8"><DoesWhy id="pay" tone="accent" /></div>
              <div className="mt-8"><TryFree tone="accent">Run your first payroll</TryFree></div>
            </div>
            <PayrollMock />
          </div>
          <dl className="mt-16 grid border-t border-white/30 sm:grid-cols-3">
            {[['41', 'timesheets approved'], ['1 click', 'to build the payroll'], ['0', 'numbers re-typed']].map(([n, l]) => (
              <div key={l} className="border-b border-white/30 py-6 sm:border-b-0 sm:pr-6">
                <dt className="font-serif text-[44px] font-bold leading-none">{n}</dt>
                <dd className="mt-2 text-[16px] text-white/85">{l}</dd>
              </div>
            ))}
          </dl>
        </Wrap>
      </section>

      {/* 07 Earn — bento */}
      <section id="earn" className="scroll-mt-16 py-24">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex justify-center"><StepTag n={7} /></div>
            <Title id="earn" className="mt-5" />
          </div>
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col justify-between bg-[#141414] p-8 text-white lg:row-span-1">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#f08a5d]">Your commission this month</p>
              <p className="mt-6 font-serif text-[64px] font-bold leading-none sm:text-[76px]">£3,884</p>
              <p className="mt-4 text-[16px] text-[#bdb6a2]">From three placements. Every pound traced to a fee.</p>
            </div>
            <div className="flex items-center rounded-[8px] bg-[#ebe5d6] p-5 sm:p-8 lg:col-span-2 lg:row-span-2">
              <div className="w-full"><MoneyMock /></div>
            </div>
            <div className="border border-[#cfc8b8] px-8 py-3">
              <DoesWhy id="earn" stacked />
            </div>
          </div>
        </Wrap>
      </section>

      {/* 08 Control — dashboard card with the summary beside it */}
      <section id="control" className="scroll-mt-16 border-t border-[#d9d2c1] bg-[#ebe5d6] py-24">
        <Wrap>
          <div className="grid items-stretch gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="flex items-center"><div className="w-full"><ControlMock /></div></div>
            <div className="flex flex-col justify-center bg-[#141414] p-8 text-white sm:p-10">
              <StepTag n={8} tone="dark" />
              <Title id="control" tone="dark" className="mt-5 sm:text-[2.2rem]" />
              <div className="mt-6"><DoesWhy id="control" tone="dark" /></div>
              <div className="mt-8"><TryFree tone="dark">See your numbers</TryFree></div>
            </div>
          </div>
        </Wrap>
      </section>

      {/* Before / after */}
      <section id="compare" className="scroll-mt-16 bg-[#ebe5d6] py-24">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>The difference</Eyebrow>
            <H2>Before and after.</H2>
          </div>
          <div className="mt-14 overflow-hidden border border-[#cfc8b8] bg-[#f6f3ec]">
            <div className="grid grid-cols-2 text-[12px] font-bold uppercase tracking-[0.16em]">
              <span className="border-r border-[#cfc8b8] bg-[#e1dac8] px-6 py-4 text-[#6b6657]">Without it</span>
              <span className="bg-[#141414] px-6 py-4 text-[#f08a5d]">With Recruitment CRM</span>
            </div>
            {COMPARE.map(([a, b]) => (
              <div key={a} className="grid grid-cols-2 border-t border-[#cfc8b8] text-[16px]">
                <span className="border-r border-[#cfc8b8] px-6 py-5 text-[#6b6657]">{a}</span>
                <span className="px-6 py-5 font-semibold">{b}</span>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-16 py-24">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Who it’s for</Eyebrow>
            <H2>Everyone gets what they need.</H2>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.role}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-[8px] bg-[#ebe5d6]">
                  <Image src={r.src} alt={r.alt} fill sizes="(min-width: 1024px) 264px, (min-width: 640px) 50vw, 100vw" className="object-cover object-top" />
                </div>
                <h3 className="mt-5 font-serif text-[26px] font-bold">{r.role}</h3>
                <p className="mt-1 text-[16px] leading-snug text-[#4a4538]">{r.gain}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Get started */}
      <section className="bg-[#ebe5d6] py-24">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Get started</Eyebrow>
            <H2>Running in three steps.</H2>
          </div>
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {START.map(([t, d], i) => (
              <li key={t} className="border border-[#cfc8b8] bg-[#f6f3ec] p-8">
                <span className="font-serif text-[44px] font-bold leading-none text-[#c2410c]">{i + 1}</span>
                <h3 className="mt-4 font-serif text-[24px] font-bold">{t}</h3>
                <p className="mt-2 text-[16px] leading-snug text-[#4a4538]">{d}</p>
              </li>
            ))}
          </ol>
        </Wrap>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 py-24">
        <Wrap>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Eyebrow>FAQ</Eyebrow>
              <H2>Quick answers.</H2>
              <p className="mt-4 max-w-sm text-[18px] text-[#4a4538]">Still unsure? Create an account and look around. It takes a minute.</p>
              <div className="mt-8"><TryFree /></div>
            </div>
            <div className="border-t border-[#141414]">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group border-b border-[#cfc8b8] py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-[20px] font-bold">
                    {q}
                    <span className="font-sans text-2xl font-light text-[#c2410c] transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-md text-[16px] leading-snug text-[#4a4538]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </Wrap>
      </section>

      {/* Closing */}
      <section className="bg-[#141414] py-28 text-center text-[#f6f3ec]">
        <Wrap>
          <h2 className="mx-auto max-w-3xl font-serif text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-[4rem]">Stop chasing. Start placing.</h2>
          <p className="mt-5 text-[19px] text-[#d6d0be]">One workspace. Your whole agency.</p>
          <div className="mt-10 flex justify-center"><TryFree tone="dark" large /></div>
        </Wrap>
      </section>

      <footer className="bg-[#141414] pb-10 text-[14px] text-[#8a846f]">
        <Wrap className="flex flex-col items-center justify-between gap-3 border-t border-white/15 pt-8 sm:flex-row">
          <span className="font-serif text-[17px] font-bold text-[#f6f3ec]">Recruitment CRM</span>
          <span>© {new Date().getFullYear()} Recruitment CRM</span>
        </Wrap>
      </footer>

      {/* Always-visible call to action on phones */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d9d2c1] bg-[#f6f3ec]/95 p-3 backdrop-blur sm:hidden">
        <Link href={REGISTER} className="flex h-12 w-full items-center justify-center bg-[#c2410c] text-[16px] font-semibold text-white">Try free</Link>
      </div>
    </div>
  );
}
