import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Recruitment CRM — One system for your agency',
  description: 'One calm place for your whole agency. Less admin, clearer decisions, more time for people.',
};

const REGISTER = '/register';

/* ───────────────────────── content ─────────────────────────
 * Deliberately high level: the page explains the idea, the purpose and where it helps, and nothing about how the
 * product is built, what screens or parts it has, or how anything works inside. Keep it that way when editing.
 * No invented figures, customers or quotes either: only claims the business can stand behind.
 */

const WHY = [
  { title: 'See the whole picture', text: 'Know where things stand at a glance, without asking around or digging for answers.' },
  { title: 'Get your hours back', text: 'Less chasing, less repeating, less juggling. More time for the people who matter.' },
  { title: 'Stay in control', text: 'Everyone sees what they should, and nothing they shouldn’t. You decide.' },
];

const PRINCIPLES = [
  ['Less admin', 'The routine takes care of itself.'],
  ['Clearer decisions', 'A true picture, whenever you look.'],
  ['Stronger teams', 'Everyone working the same way.'],
];

const WHERE = [
  { title: 'Recruitment agencies', text: 'From a boutique of three to a busy floor of thirty.' },
  { title: 'Staffing and temporary work', text: 'Fast-moving teams that have to keep up every single day.' },
  { title: 'Specialist and executive search', text: 'Relationship-led work where nothing can slip through.' },
  { title: 'Growing teams', text: 'A system that scales as quickly as you do.' },
  { title: 'Multi-office agencies', text: 'Everyone on the same page, wherever they sit.' },
  { title: 'In-house hiring teams', text: 'Companies that recruit for themselves and want it to feel easy.' },
];

const ROLES = [
  { role: 'Recruiters', gain: 'More time for people, less for admin.', src: '/landing/recruiter.jpg', alt: 'A recruitment consultant' },
  { role: 'Managers', gain: 'A clear view of how the team is doing.', src: '/landing/manager.jpg', alt: 'An agency manager' },
  { role: 'Finance', gain: 'Fewer manual steps. Fewer mistakes.', src: '/landing/finance.jpg', alt: 'A finance officer' },
  { role: 'Owners', gain: 'Peace of mind, in control of the whole agency.', src: '/landing/owner.jpg', alt: 'An agency owner' },
];

const COMMITMENTS = [
  { title: 'Private by design', text: 'Your agency’s information is kept separate from everyone else’s and protected.' },
  { title: 'You decide who sees what', text: 'Give each person the access they need, and nothing more.' },
  { title: 'Set up with a person', text: 'Tell us about your agency and we will get back to you and help you begin.' },
];

const START = [
  ['Create your account', 'Tell us a little about your agency.'],
  ['We get back to you', 'We set things up with you.'],
  ['Start working', 'A calmer, clearer way to run your agency.'],
];

const FAQ: [string, string][] = [
  ['Who is it for?', 'Recruitment and staffing agencies, and any team that hires people.'],
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
  return (
    <p className={`flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.2em] ${light ? 'text-[#e8956b]' : 'text-[#b4380a]'}`}>
      <span className={`h-px w-8 ${light ? 'bg-[#e8956b]' : 'bg-[#b4380a]'}`} />
      {children}
    </p>
  );
}

function H2({ children, light = false, className = '' }: { children: ReactNode; light?: boolean; className?: string }) {
  return <h2 className={`mt-4 font-serif text-[2.2rem] font-bold leading-[1.06] tracking-tight sm:text-[3.1rem] ${light ? 'text-[#f6f3ec]' : 'text-[#141414]'} ${className}`}>{children}</h2>;
}

type Tone = 'paper' | 'dark';

function TryFree({ tone = 'paper', large = false, children = 'Try free' }: { tone?: Tone; large?: boolean; children?: ReactNode }) {
  const styles: Record<Tone, string> = {
    paper: 'focus-visible:ring-[#b4380a] focus-visible:ring-offset-[#f6f3ec]',
    dark: 'focus-visible:ring-white focus-visible:ring-offset-[#141414]',
  };
  return (
    <Link
      href={REGISTER}
      className={`group inline-flex items-center justify-center gap-3 bg-[#b4380a] font-semibold text-white transition-colors hover:bg-[#8f2c08] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${large ? 'h-14 px-9 text-[17px]' : 'h-12 px-7 text-[15px]'} ${styles[tone]}`}
    >
      {children}
      <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 10h12M11 5l5 5-5 5" />
      </svg>
    </Link>
  );
}

function Tick({ light = false }: { light?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${light ? 'text-[#e8956b]' : 'text-[#b4380a]'}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen scroll-smooth overflow-x-clip bg-[#f6f3ec] pb-16 text-[#141414] antialiased sm:pb-0">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-[#d9d2c1] bg-[#f6f3ec]/95 backdrop-blur">
        <Wrap className="flex h-[68px] items-center justify-between">
          <Link href="/" className="font-serif text-[21px] font-bold tracking-tight">Recruitment CRM</Link>
          <nav className="hidden items-center gap-10 text-[14px] font-medium text-[#4a4538] md:flex">
            <a href="#why" className="hover:text-[#141414]">Why</a>
            <a href="#purpose" className="hover:text-[#141414]">Purpose</a>
            <a href="#where" className="hover:text-[#141414]">Where it helps</a>
            <a href="#faq" className="hover:text-[#141414]">FAQ</a>
          </nav>
          <Link href={REGISTER} className="inline-flex h-10 items-center bg-[#b4380a] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#8f2c08]">Try free</Link>
        </Wrap>
      </header>

      {/* Hero */}
      <section className="pb-20 pt-14 lg:pb-28 lg:pt-20">
        <Wrap>
          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <div>
              <Eyebrow>For recruitment agencies</Eyebrow>
              <h1 className="mt-6 font-serif text-[3rem] font-bold leading-[1.0] tracking-[-0.025em] sm:text-[4.6rem]">
                Run your agency with clarity.
              </h1>
              <p className="mt-7 max-w-xl text-[20px] leading-[1.45] text-[#4a4538]">
                One calm place for your whole agency. Less admin, clearer decisions, and more time for the people you work with.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                <TryFree large />
                <a href="#why" className="text-[16px] font-semibold underline decoration-[#b4380a] decoration-2 underline-offset-[6px] hover:text-[#b4380a]">
                  Why it matters
                </a>
              </div>
              <ul className="mt-12 grid max-w-xl gap-3 border-t border-[#d9d2c1] pt-6 text-[15px] font-medium text-[#4a4538] sm:grid-cols-3">
                {['Nothing to install', 'Made for teams', 'Private and protected'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <Tick />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <figure className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="absolute -bottom-4 -right-4 hidden h-full w-full border border-[#141414] sm:block" aria-hidden="true" />
              <div className="relative aspect-[4/5] overflow-hidden bg-[#ebe5d6]">
                <Image src="/landing/manager.jpg" alt="An agency manager" fill priority sizes="(min-width: 1024px) 460px, 90vw" className="object-cover object-top" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-6 pb-6 pt-16 text-white">
                  <span className="block font-serif text-[22px] font-bold leading-tight">One clear view of the whole agency.</span>
                </figcaption>
              </div>
            </figure>
          </div>
        </Wrap>
      </section>

      {/* Why */}
      <section id="why" className="scroll-mt-16 border-y border-[#d9d2c1] bg-[#fbf9f4] py-24">
        <Wrap>
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-16">
            <div>
              <Eyebrow>Why teams choose it</Eyebrow>
              <H2>A calmer way to work.</H2>
            </div>
            <p className="max-w-md text-[19px] leading-snug text-[#4a4538] lg:pb-2">
              Great agencies run on relationships. The rest should take care of itself.
            </p>
          </div>
          <div className="mt-16 grid border-t border-[#141414] md:grid-cols-3">
            {WHY.map((w, i) => (
              <div key={w.title} className="border-b border-[#d9d2c1] py-10 md:border-b-0 md:border-l md:px-8 md:first:border-l-0 md:first:pl-0">
                <span className="font-serif text-[15px] font-bold tracking-[0.1em] text-[#b4380a]">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-4 font-serif text-[27px] font-bold leading-tight">{w.title}</h3>
                <p className="mt-3 text-[17px] leading-snug text-[#4a4538]">{w.text}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Purpose */}
      <section id="purpose" className="scroll-mt-16 bg-[#141414] py-24 text-[#f6f3ec]">
        <Wrap>
          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <div>
              <Eyebrow light>Our purpose</Eyebrow>
              <H2 light>Built to give agencies their time back.</H2>
              <p className="mt-6 max-w-xl text-[19px] leading-snug text-[#cfc8b8]">
                Recruitment is about people. Yet too much of the day disappears into keeping things in order. Recruitment CRM exists so the busywork never gets in the way of the work that matters.
              </p>
              <dl className="mt-10 border-t border-white/20">
                {PRINCIPLES.map(([k, v]) => (
                  <div key={k} className="grid gap-1 border-b border-white/20 py-5 sm:grid-cols-[190px_1fr] sm:gap-8">
                    <dt className="font-serif text-[21px] font-bold">{k}</dt>
                    <dd className="text-[17px] text-[#bdb6a2]">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-10"><TryFree tone="dark">Get started</TryFree></div>
            </div>
            <figure className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="absolute -left-4 -top-4 hidden h-full w-full border border-[#e8956b]/60 sm:block" aria-hidden="true" />
              <div className="relative aspect-[4/5] overflow-hidden bg-[#2a2a2a]">
                <Image src="/landing/recruiter.jpg" alt="A recruitment consultant" fill sizes="(min-width: 1024px) 420px, 90vw" className="object-cover object-top" />
              </div>
            </figure>
          </div>
        </Wrap>
      </section>

      {/* Where it helps */}
      <section id="where" className="scroll-mt-16 py-24">
        <Wrap>
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-16">
            <div>
              <Eyebrow>Where it helps</Eyebrow>
              <H2>Wherever people are hired.</H2>
            </div>
            <p className="max-w-md text-[19px] leading-snug text-[#4a4538] lg:pb-2">
              From small specialist firms to busy multi-office agencies.
            </p>
          </div>
          <ol className="mt-14 border-t border-[#141414]">
            {WHERE.map((w, i) => (
              <li key={w.title} className="group grid items-baseline gap-2 border-b border-[#d9d2c1] px-2 py-7 transition-colors hover:bg-[#ebe5d6]/60 sm:grid-cols-[72px_1.1fr_1fr] sm:gap-8 sm:px-4">
                <span className="font-serif text-[15px] font-bold tracking-[0.1em] text-[#b4380a]">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="font-serif text-[26px] font-bold leading-tight sm:text-[30px]">{w.title}</h3>
                <p className="text-[17px] leading-snug text-[#4a4538]">{w.text}</p>
              </li>
            ))}
          </ol>
        </Wrap>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-16 border-y border-[#d9d2c1] bg-[#ebe5d6] py-24">
        <Wrap>
          <div className="max-w-2xl">
            <Eyebrow>Who it’s for</Eyebrow>
            <H2>Everyone gets what they need.</H2>
          </div>
          <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.role}>
                <div className="relative aspect-[4/5] overflow-hidden bg-[#f6f3ec]">
                  <Image src={r.src} alt={r.alt} fill sizes="(min-width: 1024px) 264px, (min-width: 640px) 50vw, 100vw" className="object-cover object-top" />
                </div>
                <h3 className="mt-5 border-t border-[#141414] pt-4 font-serif text-[25px] font-bold">{r.role}</h3>
                <p className="mt-1 text-[16px] leading-snug text-[#4a4538]">{r.gain}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Commitments */}
      <section className="py-24">
        <Wrap>
          <div className="max-w-2xl">
            <Eyebrow>Our commitments</Eyebrow>
            <H2>Serious about your information.</H2>
          </div>
          <div className="mt-14 grid gap-px bg-[#d9d2c1] md:grid-cols-3">
            {COMMITMENTS.map((c) => (
              <div key={c.title} className="bg-[#f6f3ec] p-8 md:p-10">
                <Tick />
                <h3 className="mt-5 font-serif text-[25px] font-bold leading-tight">{c.title}</h3>
                <p className="mt-3 text-[17px] leading-snug text-[#4a4538]">{c.text}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Get started */}
      <section className="border-y border-[#d9d2c1] bg-[#fbf9f4] py-24">
        <Wrap>
          <div className="max-w-2xl">
            <Eyebrow>Getting started</Eyebrow>
            <H2>Simple to begin.</H2>
          </div>
          <ol className="mt-14 grid border-t border-[#141414] md:grid-cols-3">
            {START.map(([t, d], i) => (
              <li key={t} className="border-b border-[#d9d2c1] py-10 md:border-b-0 md:border-l md:px-8 md:first:border-l-0 md:first:pl-0">
                <span className="font-serif text-[48px] font-bold leading-none text-[#b4380a]">{i + 1}</span>
                <h3 className="mt-5 font-serif text-[25px] font-bold">{t}</h3>
                <p className="mt-2 text-[17px] leading-snug text-[#4a4538]">{d}</p>
              </li>
            ))}
          </ol>
        </Wrap>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 py-24">
        <Wrap>
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <Eyebrow>FAQ</Eyebrow>
              <H2>Quick answers.</H2>
              <p className="mt-5 max-w-sm text-[18px] leading-snug text-[#4a4538]">Still unsure? Create an account and we will get back to you.</p>
              <div className="mt-8"><TryFree /></div>
            </div>
            <div className="border-t border-[#141414]">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group border-b border-[#d9d2c1] py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-[22px] font-bold">
                    {q}
                    <span className="font-sans text-2xl font-light text-[#b4380a] transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-lg text-[17px] leading-snug text-[#4a4538]">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </Wrap>
      </section>

      {/* Closing */}
      <section className="bg-[#141414] py-24 text-[#f6f3ec]">
        <Wrap>
          <div className="grid items-end gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:gap-16">
            <div>
              <Eyebrow light>Ready when you are</Eyebrow>
              <h2 className="mt-5 font-serif text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-[4rem]">Stop chasing. Start placing.</h2>
              <p className="mt-5 max-w-xl text-[19px] leading-snug text-[#cfc8b8]">One workspace for your whole agency. Create an account and we will get back to you.</p>
            </div>
            <div className="lg:pb-3 lg:text-right"><TryFree tone="dark" large /></div>
          </div>
        </Wrap>
      </section>

      <footer className="bg-[#141414] pb-10 text-[14px] text-[#8a846f]">
        <Wrap className="flex flex-col items-center justify-between gap-3 border-t border-white/15 pt-8 sm:flex-row">
          <span className="font-serif text-[17px] font-bold text-[#f6f3ec]">Recruitment CRM</span>
          <span>© {new Date().getFullYear()} Recruitment CRM. All rights reserved.</span>
        </Wrap>
      </footer>

      {/* Always-visible call to action on phones */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d9d2c1] bg-[#f6f3ec]/95 p-3 backdrop-blur sm:hidden">
        <Link href={REGISTER} className="flex h-12 w-full items-center justify-center bg-[#b4380a] text-[16px] font-semibold text-white">Try free</Link>
      </div>
    </div>
  );
}
