import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { HeroDashboard, Stage } from '@/components/landing/mockups';

export const metadata: Metadata = {
  title: 'Recruitment CRM — One system for your agency',
  description: 'One simple system for recruitment and staffing agencies. Less admin, more clarity.',
};

const REGISTER = '/register';

/* ───────────────────────── content ─────────────────────────
 * Deliberately high level: the page gives the idea and the feeling of the product, and nothing about how it is
 * built, what it contains or how its parts work. Keep it that way when editing.
 */

const PROBLEMS = [
  { title: 'Too many places', text: 'Work spread across tools, notes and inboxes.' },
  { title: 'Too much admin', text: 'Hours lost on things a system should do for you.' },
  { title: 'Too little clarity', text: 'Hard to see where things really stand.' },
];

const BENEFITS = [
  { title: 'Everything together', text: 'Your agency’s work lives in one calm, organised place.' },
  { title: 'Always in the picture', text: 'Know where things stand at a glance, any day of the week.' },
  { title: 'Built for teams', text: 'Everyone sees what they need, and nothing they don’t.' },
  { title: 'Ready in minutes', text: 'Nothing to install. Open it in your browser and begin.' },
];

const ROLES = [
  { role: 'Recruiters', gain: 'More time for people, less for admin.', src: '/landing/recruiter.jpg', alt: 'A recruitment consultant' },
  { role: 'Managers', gain: 'A clear view of how the team is doing.', src: '/landing/manager.jpg', alt: 'An agency manager' },
  { role: 'Finance', gain: 'Fewer manual steps. Fewer mistakes.', src: '/landing/finance.jpg', alt: 'A finance officer' },
  { role: 'Owners', gain: 'Peace of mind, in control of the whole agency.', src: '/landing/owner.jpg', alt: 'An agency owner' },
];

const COMPARE: [string, string][] = [
  ['Scattered and hard to find', 'Organised and in one place'],
  ['Repeating the same tasks', 'Less repetition, more focus'],
  ['Guessing where things stand', 'A clear picture, any day'],
];

const START = [
  ['Create your account', 'Tell us about your agency.'],
  ['We get back to you', 'We set things up and help you begin.'],
  ['Start working', 'Enjoy a calmer, clearer way to run your agency.'],
];

const FAQ: [string, string][] = [
  ['Who is it for?', 'Recruitment and staffing agencies.'],
  ['Do I install anything?', 'No. It runs in your browser.'],
  ['Can my whole team use it?', 'Yes. It is made for teams.'],
  ['Is my information safe?', 'Yes. Your information is private and protected.'],
  ['How do I get access?', 'Create an account and tell us about your agency. We will get back to you.'],
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

type Tone = 'paper' | 'dark';

function TryFree({ tone = 'paper', large = false, children = 'Try free' }: { tone?: Tone; large?: boolean; children?: ReactNode }) {
  const styles: Record<Tone, string> = {
    paper: 'bg-[#c2410c] text-white hover:bg-[#9a3412] focus-visible:ring-[#c2410c] focus-visible:ring-offset-[#f6f3ec]',
    dark: 'bg-[#c2410c] text-white hover:bg-[#e0541a] focus-visible:ring-white focus-visible:ring-offset-[#141414]',
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

/* ───────────────────────── page ───────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen scroll-smooth overflow-x-clip bg-[#f6f3ec] pb-16 text-[#141414] antialiased sm:pb-0">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-[#d9d2c1] bg-[#f6f3ec]/95 backdrop-blur">
        <Wrap className="flex h-16 items-center justify-between">
          <Link href="/" className="font-serif text-[20px] font-bold tracking-tight">Recruitment CRM</Link>
          <nav className="hidden items-center gap-9 text-[14px] font-medium text-[#4a4538] md:flex">
            <a href="#why" className="hover:text-[#141414]">Why it matters</a>
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

      {/* The idea, in a few plain words */}
      <section className="bg-[#141414] py-24 text-[#f6f3ec]">
        <Wrap>
          <div className="grid items-end gap-8 lg:grid-cols-2 lg:gap-16">
            <div>
              <Eyebrow light>The problem</Eyebrow>
              <H2 light>Sound familiar?</H2>
            </div>
            <p className="max-w-md text-[19px] leading-snug text-[#bdb6a2] lg:pb-2">
              Running an agency should feel organised, not overwhelming.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PROBLEMS.map((p) => (
              <div key={p.title} className="border border-white/15 p-8">
                <h3 className="font-serif text-[26px] font-bold">{p.title}</h3>
                <p className="mt-3 text-[17px] leading-snug text-[#bdb6a2]">{p.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-16 text-center font-serif text-[26px] text-[#e7e1d3] sm:text-[32px]">
            It is one problem. <span className="text-[#f08a5d]">Put it in one place.</span>
          </p>
        </Wrap>
      </section>

      {/* Why it matters */}
      <section id="why" className="scroll-mt-16 py-24">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Why it matters</Eyebrow>
            <H2>Calmer days. Clearer decisions.</H2>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {BENEFITS.map((b, i) => (
              <div key={b.title} className="border border-[#cfc8b8] bg-[#f6f3ec] p-8">
                <span className="font-serif text-[44px] font-bold leading-none text-[#c2410c]">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-4 font-serif text-[26px] font-bold">{b.title}</h3>
                <p className="mt-2 text-[17px] leading-snug text-[#4a4538]">{b.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 flex justify-center"><TryFree large /></div>
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
            <H2>Simple to begin.</H2>
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
              <p className="mt-4 max-w-sm text-[18px] text-[#4a4538]">Still unsure? Create an account and we will get back to you.</p>
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
