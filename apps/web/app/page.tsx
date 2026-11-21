import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Recruitment CRM — One system for your agency',
  description: 'One calm place for your whole agency. Less admin, more clarity, more time for people.',
};

const REGISTER = '/register';

/* ───────────────────────── content ─────────────────────────
 * Deliberately high level: the page explains the idea, the purpose and where it helps, and nothing about how the
 * product is built, what screens or parts it has, or how anything works inside. Keep it that way when editing.
 */

type IconName = 'people' | 'building' | 'clock' | 'eye' | 'shield' | 'growth' | 'layers' | 'globe' | 'spark' | 'heart' | 'key' | 'briefcase';

const WHY: { icon: IconName; title: string; text: string }[] = [
  { icon: 'eye', title: 'See the whole picture', text: 'Know where things stand at a glance, without asking around or digging for answers.' },
  { icon: 'clock', title: 'Get your hours back', text: 'Less chasing, less repeating, less juggling. More time for the people who matter.' },
  { icon: 'key', title: 'Stay in control', text: 'Everyone sees what they should, and nothing they shouldn’t. You decide.' },
];

const WHERE: { icon: IconName; title: string; text: string }[] = [
  { icon: 'briefcase', title: 'Recruitment agencies', text: 'From a boutique of three to a busy floor of thirty.' },
  { icon: 'clock', title: 'Staffing and temporary work', text: 'Fast-moving teams that have to keep up every single day.' },
  { icon: 'spark', title: 'Specialist and executive search', text: 'Relationship-led work where nothing can slip through.' },
  { icon: 'growth', title: 'Growing teams', text: 'A system that scales as quickly as you do.' },
  { icon: 'globe', title: 'Multi-office agencies', text: 'Everyone on the same page, wherever they sit.' },
  { icon: 'building', title: 'In-house hiring teams', text: 'Companies that recruit for themselves and want it to feel easy.' },
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
  ['Everyone working differently', 'The whole team in step'],
];

const START = [
  ['Create your account', 'Tell us a little about your agency.'],
  ['We get back to you', 'We set things up and help you begin.'],
  ['Start working', 'Enjoy a calmer, clearer way to run your agency.'],
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

/** Simple line icons, drawn here so the page needs nothing else. */
function Icon({ name, className = 'h-6 w-6' }: { name: IconName; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const paths: Record<IconName, ReactNode> = {
    people: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M2.8 19c.5-3.4 3-5.2 6.2-5.2s5.7 1.8 6.2 5.2" />
        <circle cx="17.2" cy="9" r="2.4" />
        <path d="M17.6 14.2c2.1.2 3.4 1.6 3.8 4.3" />
      </>
    ),
    building: (
      <>
        <rect x="5" y="3" width="10" height="18" rx="1" />
        <path d="M15 9h4v12h-4M8.5 7.5h3M8.5 11h3M8.5 14.5h3M3 21h18" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5.2l3.4 2" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    shield: <path d="M12 3 4.5 6v5.6c0 4.4 3 7.6 7.5 9.4 4.5-1.8 7.5-5 7.5-9.4V6L12 3Zm-3 9 2.2 2.2L15.2 10" />,
    growth: <path d="M3.5 17.5 9 12l3.5 3.5L20.5 7M15 7h5.5v5.5" />,
    layers: <path d="m12 3.5 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16.5l9 5 9-5" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.3 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.3-3.8-8.5S9.4 5.9 12 3.5Z" />
      </>
    ),
    spark: <path d="m12 3 1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8.8-2.2Z" />,
    heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20Z" />,
    key: (
      <>
        <circle cx="8" cy="12" r="3.6" />
        <path d="M11.6 12H21m-3 0v3.2m-3-3.2v2.2" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7.5" width="18" height="12" rx="2" />
        <path d="M9 7.5V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8v1.7M3 13h18" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      {paths[name]}
    </svg>
  );
}

/** A round icon on a coloured tile. */
function Badge({ icon, tone = 'accent' }: { icon: IconName; tone?: 'accent' | 'dark' | 'light' }) {
  const styles = {
    accent: 'bg-[#c2410c] text-white',
    dark: 'bg-[#141414] text-[#f08a5d]',
    light: 'bg-[#f6f3ec] text-[#c2410c]',
  } as const;
  return (
    <span className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_10px_24px_-12px_rgba(194,65,12,0.7)] ${styles[tone]}`}>
      <Icon name={icon} className="h-7 w-7" />
    </span>
  );
}

/** The hero picture: one hub with six ideas around it. Shapes and icons only, nothing about the product itself. */
function HeroArt() {
  const nodes: { icon: IconName; label: string; x: number; y: number }[] = [
    { icon: 'people', label: 'People', x: 50, y: 9 },
    { icon: 'briefcase', label: 'Work', x: 88, y: 31 },
    { icon: 'growth', label: 'Growth', x: 88, y: 69 },
    { icon: 'clock', label: 'Time', x: 50, y: 91 },
    { icon: 'shield', label: 'Trust', x: 12, y: 69 },
    { icon: 'eye', label: 'Clarity', x: 12, y: 31 },
  ];
  return (
    <div className="relative mx-auto aspect-[1/1] w-full max-w-[520px]" aria-hidden="true">
      <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle_at_50%_50%,#f3d9c8_0%,#f6f3ec_68%)]" />
      <div className="absolute inset-[22%] rounded-full border border-dashed border-[#c2410c]/30" />
      <div className="absolute inset-[3%] rounded-full border border-[#d9d2c1]" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        {nodes.map((n) => (
          <line key={n.label} x1="50" y1="50" x2={n.x} y2={n.y} stroke="#c2410c" strokeOpacity="0.35" strokeWidth="0.35" strokeDasharray="1.2 1.2" />
        ))}
      </svg>
      <div className="absolute left-1/2 top-1/2 flex h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[28%] bg-[#141414] shadow-[0_30px_60px_-24px_rgba(20,20,20,0.8)]">
        <div className="flex items-end gap-[7%]">
          <span className="h-[22px] w-[9px] rounded-sm bg-[#f08a5d] sm:h-[34px] sm:w-[13px]" />
          <span className="h-[34px] w-[9px] rounded-sm bg-[#c2410c] sm:h-[52px] sm:w-[13px]" />
          <span className="h-[28px] w-[9px] rounded-sm bg-[#f6f3ec] sm:h-[42px] sm:w-[13px]" />
        </div>
      </div>
      {nodes.map((n) => (
        <div key={n.label} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#c2410c] shadow-[0_14px_28px_-14px_rgba(20,20,20,0.55)] ring-1 ring-[#e7e1d3] sm:h-16 sm:w-16">
            <Icon name={n.icon} className="h-6 w-6 sm:h-7 sm:w-7" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4a4538] sm:text-[12px]">{n.label}</span>
        </div>
      ))}
    </div>
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
            <a href="#why" className="hover:text-[#141414]">Why</a>
            <a href="#purpose" className="hover:text-[#141414]">Purpose</a>
            <a href="#where" className="hover:text-[#141414]">Where it helps</a>
            <a href="#faq" className="hover:text-[#141414]">FAQ</a>
          </nav>
          <Link href={REGISTER} className="inline-flex h-10 items-center bg-[#c2410c] px-5 text-[14px] font-semibold text-white hover:bg-[#9a3412]">Try free</Link>
        </Wrap>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pb-20 pt-14 lg:pt-20">
        <Wrap>
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            <div>
              <Eyebrow>For recruitment agencies</Eyebrow>
              <h1 className="mt-5 font-serif text-[3rem] font-bold leading-[1] tracking-[-0.025em] sm:text-[4.6rem]">
                Run your agency
                <span className="block text-[#c2410c]">with clarity.</span>
              </h1>
              <p className="mt-6 max-w-lg text-[20px] leading-snug text-[#4a4538]">
                One calm place for your whole agency. Less admin, clearer decisions, and more time for the people you work with.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <TryFree large />
                <a href="#why" className="inline-flex h-14 items-center border border-[#141414] px-8 text-[16px] font-semibold transition-colors hover:bg-[#141414] hover:text-white">
                  Why it matters
                </a>
              </div>
              <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-[15px] font-medium text-[#4a4538]">
                {['Nothing to install', 'Made for teams', 'Private and protected'].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#c2410c] text-white">
                      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <HeroArt />
          </div>
        </Wrap>
      </section>

      {/* Why */}
      <section id="why" className="scroll-mt-16 bg-[#141414] py-24 text-[#f6f3ec]">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow light>Why use it</Eyebrow>
            <H2 light>Because your agency deserves a calmer way to work.</H2>
            <p className="mt-5 text-[19px] leading-snug text-[#bdb6a2]">
              Great agencies run on relationships. The rest should take care of itself.
            </p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {WHY.map((w) => (
              <div key={w.title} className="group rounded-3xl border border-white/10 bg-white/[0.04] p-8 transition-colors hover:bg-white/[0.07]">
                <Badge icon={w.icon} />
                <h3 className="mt-6 font-serif text-[27px] font-bold leading-tight">{w.title}</h3>
                <p className="mt-3 text-[17px] leading-snug text-[#bdb6a2]">{w.text}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Purpose */}
      <section id="purpose" className="scroll-mt-16 py-24">
        <Wrap>
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-[#ebe5d6]" />
              <div className="grid grid-cols-2 gap-4 p-4">
                <div className="flex aspect-square flex-col justify-between rounded-3xl bg-[#c2410c] p-6 text-white">
                  <Icon name="clock" className="h-9 w-9" />
                  <p className="font-serif text-[26px] font-bold leading-tight">Less admin</p>
                </div>
                <div className="flex aspect-square flex-col justify-between rounded-3xl bg-white p-6 text-[#141414] ring-1 ring-[#e7e1d3]">
                  <Icon name="eye" className="h-9 w-9 text-[#c2410c]" />
                  <p className="font-serif text-[26px] font-bold leading-tight">Clearer decisions</p>
                </div>
                <div className="flex aspect-square flex-col justify-between rounded-3xl bg-white p-6 text-[#141414] ring-1 ring-[#e7e1d3]">
                  <Icon name="heart" className="h-9 w-9 text-[#c2410c]" />
                  <p className="font-serif text-[26px] font-bold leading-tight">Happier teams</p>
                </div>
                <div className="flex aspect-square flex-col justify-between rounded-3xl bg-[#141414] p-6 text-white">
                  <Icon name="growth" className="h-9 w-9 text-[#f08a5d]" />
                  <p className="font-serif text-[26px] font-bold leading-tight">Room to grow</p>
                </div>
              </div>
            </div>
            <div>
              <Eyebrow>Our purpose</Eyebrow>
              <H2>Built to give agencies their time back.</H2>
              <p className="mt-6 text-[19px] leading-snug text-[#4a4538]">
                Recruitment is about people. Yet too much of the day disappears into keeping things in order. Recruitment CRM exists so the busywork never gets in the way of the work that matters.
              </p>
              <p className="mt-4 text-[19px] leading-snug text-[#4a4538]">
                One place. One picture. One team, in step.
              </p>
              <div className="mt-8"><TryFree>Get started</TryFree></div>
            </div>
          </div>
        </Wrap>
      </section>

      {/* Where it helps */}
      <section id="where" className="scroll-mt-16 border-t border-[#d9d2c1] bg-[#ebe5d6] py-24">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Where it helps</Eyebrow>
            <H2>Wherever people are hired.</H2>
            <p className="mt-5 text-[19px] leading-snug text-[#4a4538]">
              From small specialist firms to busy multi-office agencies.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHERE.map((w) => (
              <div key={w.title} className="flex gap-5 rounded-3xl bg-[#f6f3ec] p-7 ring-1 ring-[#d9d2c1] transition-shadow hover:shadow-[0_24px_40px_-26px_rgba(20,20,20,0.5)]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#c2410c]/10 text-[#c2410c]">
                  <Icon name={w.icon} className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-serif text-[22px] font-bold leading-tight">{w.title}</h3>
                  <p className="mt-2 text-[16px] leading-snug text-[#4a4538]">{w.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Before / after */}
      <section id="compare" className="scroll-mt-16 py-24">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>The difference</Eyebrow>
            <H2>Before and after.</H2>
          </div>
          <div className="mt-14 overflow-hidden rounded-3xl border border-[#cfc8b8] bg-[#f6f3ec]">
            <div className="grid grid-cols-2 text-[12px] font-bold uppercase tracking-[0.16em]">
              <span className="border-r border-[#cfc8b8] bg-[#e1dac8] px-6 py-4 text-[#6b6657]">Without it</span>
              <span className="bg-[#141414] px-6 py-4 text-[#f08a5d]">With Recruitment CRM</span>
            </div>
            {COMPARE.map(([a, b]) => (
              <div key={a} className="grid grid-cols-2 border-t border-[#cfc8b8] text-[16px]">
                <span className="border-r border-[#cfc8b8] px-6 py-5 text-[#6b6657]">{a}</span>
                <span className="flex items-center gap-3 px-6 py-5 font-semibold">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#c2410c] text-white">
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
                  </span>
                  {b}
                </span>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-16 bg-[#ebe5d6] py-24">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Who it’s for</Eyebrow>
            <H2>Everyone gets what they need.</H2>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.role}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-[#f6f3ec]">
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
      <section className="py-24">
        <Wrap>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Get started</Eyebrow>
            <H2>Simple to begin.</H2>
          </div>
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {START.map(([t, d], i) => (
              <li key={t} className="relative rounded-3xl border border-[#cfc8b8] bg-[#f6f3ec] p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c2410c] font-serif text-[22px] font-bold text-white">{i + 1}</span>
                <h3 className="mt-5 font-serif text-[24px] font-bold">{t}</h3>
                <p className="mt-2 text-[16px] leading-snug text-[#4a4538]">{d}</p>
              </li>
            ))}
          </ol>
        </Wrap>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 bg-[#ebe5d6] py-24">
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
      <section className="relative overflow-hidden bg-[#141414] py-28 text-center text-[#f6f3ec]">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#c2410c]/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#f08a5d]/20 blur-3xl" aria-hidden="true" />
        <Wrap className="relative">
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
