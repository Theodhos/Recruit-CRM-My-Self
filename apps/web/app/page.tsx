import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Recruitment CRM — One system for your agency',
  description: 'One calm place for your whole agency. Less admin, clearer decisions, more time for people.',
};

const REGISTER = '/register';

/* ───────────────────────── content ─────────────────────────
 * Deliberately high level: the page explains the idea, the purpose and where it helps, and nothing about how the
 * product is built, what screens or parts it has, or how anything works inside. Keep it that way when editing.
 * No invented figures, customers or quotes either: only claims the business can stand behind.
 * The pictures are drawn shapes and patterns: no icons, no stock images, no screens.
 */

const INK = '#141414';
const PAPER = '#f6f3ec';
const SAND = '#ebe5d6';
const RUST = '#b4380a';
const SOFT = '#e8956b';

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

/** Each tile of "where it helps" carries its own quiet pattern, drawn with CSS gradients. */
const WHERE: { title: string; text: string; tone: string; pattern: CSSProperties }[] = [
  {
    title: 'Recruitment agencies',
    text: 'From a boutique of three to a busy floor of thirty.',
    tone: 'bg-[#141414] text-[#f6f3ec]',
    pattern: { backgroundImage: 'radial-gradient(rgba(246,243,236,0.22) 1.3px, transparent 1.6px)', backgroundSize: '16px 16px' },
  },
  {
    title: 'Staffing and temporary work',
    text: 'Fast-moving teams that have to keep up every single day.',
    tone: 'bg-[#b4380a] text-white',
    pattern: { backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.2) 0 1px, transparent 1px 13px)' },
  },
  {
    title: 'Specialist and executive search',
    text: 'Relationship-led work where nothing can slip through.',
    tone: 'bg-[#fbf9f4] text-[#141414] ring-1 ring-inset ring-[#d9d2c1]',
    pattern: { backgroundImage: 'repeating-radial-gradient(circle at 100% 100%, rgba(20,20,20,0.13) 0 1px, transparent 1px 22px)' },
  },
  {
    title: 'Growing teams',
    text: 'A system that scales as quickly as you do.',
    tone: 'bg-[#ebe5d6] text-[#141414]',
    pattern: { backgroundImage: 'linear-gradient(rgba(20,20,20,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(20,20,20,0.12) 1px, transparent 1px)', backgroundSize: '26px 26px' },
  },
  {
    title: 'Multi-office agencies',
    text: 'Everyone on the same page, wherever they sit.',
    tone: 'bg-[#141414] text-[#f6f3ec]',
    pattern: { backgroundImage: 'repeating-linear-gradient(0deg, rgba(246,243,236,0.16) 0 1px, transparent 1px 11px)' },
  },
  {
    title: 'In-house hiring teams',
    text: 'Companies that recruit for themselves and want it to feel easy.',
    tone: 'bg-[#fbf9f4] text-[#141414] ring-1 ring-inset ring-[#d9d2c1]',
    pattern: { backgroundImage: 'radial-gradient(rgba(180,56,10,0.35) 1.3px, transparent 1.6px)', backgroundSize: '18px 18px' },
  },
];

const ROLES = [
  { letter: 'R', role: 'Recruiters', gain: 'More time for people, less for admin.' },
  { letter: 'M', role: 'Managers', gain: 'A clear view of how the team is doing.' },
  { letter: 'F', role: 'Finance', gain: 'Fewer manual steps. Fewer mistakes.' },
  { letter: 'O', role: 'Owners', gain: 'Peace of mind, in control of the whole agency.' },
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
  const ring = tone === 'dark' ? 'focus-visible:ring-white focus-visible:ring-offset-[#141414]' : 'focus-visible:ring-[#b4380a] focus-visible:ring-offset-[#f6f3ec]';
  return (
    <Link
      href={REGISTER}
      className={`inline-flex items-center justify-center bg-[#b4380a] font-semibold text-white transition-colors hover:bg-[#8f2c08] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${large ? 'h-14 px-10 text-[17px]' : 'h-12 px-8 text-[15px]'} ${ring}`}
    >
      {children}
    </Link>
  );
}

/** The hero picture: nine square modules of plain geometry, in the page's own colours. Shapes only. */
function HeroArt() {
  return (
    <svg viewBox="0 0 480 480" className="mx-auto h-auto w-full max-w-[520px]" role="img" aria-label="">
      <rect width="480" height="480" fill="#fbf9f4" />
      {/* row 1 */}
      <g>
        <path d="M0,160 L160,160 A160,160 0 0 0 0,0 Z" fill={RUST} />
      </g>
      <g transform="translate(160 0)">
        <rect width="160" height="160" fill={INK} />
        <circle cx="80" cy="80" r="46" fill={PAPER} />
        <circle cx="80" cy="80" r="14" fill={RUST} />
      </g>
      <g transform="translate(320 0)">
        <rect width="160" height="160" fill={SAND} />
        <rect x="26" y="28" width="26" height="104" fill={INK} />
        <rect x="67" y="58" width="26" height="74" fill={INK} />
        <rect x="108" y="88" width="26" height="44" fill={RUST} />
      </g>
      {/* row 2 */}
      <svg x="0" y="160" width="160" height="160" viewBox="0 0 160 160">
        <rect width="160" height="160" fill="#fbf9f4" />
        {[36, 72, 108, 144, 180].map((r) => (
          <circle key={r} cx="0" cy="160" r={r} fill="none" stroke={INK} strokeWidth="1.6" />
        ))}
      </svg>
      <g transform="translate(160 160)">
        <rect width="160" height="160" fill={RUST} />
        <rect x="44" y="44" width="72" height="72" fill="none" stroke={PAPER} strokeWidth="2" />
        <rect x="64" y="64" width="32" height="32" fill={PAPER} />
      </g>
      <g transform="translate(320 160)">
        <rect width="160" height="160" fill="#fbf9f4" />
        <path d="M160,0 L0,0 A160,160 0 0 0 160,160 Z" fill={INK} />
      </g>
      {/* row 3 */}
      <g transform="translate(0 320)">
        <rect width="160" height="160" fill={SAND} />
        <rect x="28" y="28" width="104" height="22" fill={INK} />
        <rect x="28" y="69" width="72" height="22" fill={INK} />
        <rect x="28" y="110" width="40" height="22" fill={RUST} />
      </g>
      <g transform="translate(160 320)">
        <rect width="160" height="160" fill="#fbf9f4" />
        <circle cx="80" cy="80" r="54" fill="none" stroke={INK} strokeWidth="2" />
        <circle cx="80" cy="80" r="30" fill="none" stroke={INK} strokeWidth="1.2" />
        <circle cx="106" cy="54" r="9" fill={RUST} />
      </g>
      <g transform="translate(320 320)">
        <rect width="160" height="160" fill={SOFT} />
        <path d="M20,112 A60,60 0 0 1 140,112 Z" fill={INK} />
        <rect x="20" y="112" width="120" height="3" fill={INK} />
      </g>
      {/* hairlines between the modules */}
      <g stroke={INK} strokeOpacity="0.18" strokeWidth="1">
        <line x1="160" y1="0" x2="160" y2="480" />
        <line x1="320" y1="0" x2="320" y2="480" />
        <line x1="0" y1="160" x2="480" y2="160" />
        <line x1="0" y1="320" x2="480" y2="320" />
      </g>
    </svg>
  );
}

/** One small drawing for each reason on the page: rings, falling bars, a grid with a few squares picked out. */
function WhyArt({ n }: { n: 0 | 1 | 2 }) {
  if (n === 0) {
    return (
      <svg viewBox="0 0 220 110" className="h-24 w-auto" aria-hidden="true">
        {[14, 28, 42, 56].map((r) => (
          <circle key={r} cx="110" cy="55" r={r} fill="none" stroke={INK} strokeWidth="1.4" />
        ))}
        <circle cx="110" cy="55" r="7" fill={RUST} />
        <line x1="0" y1="55" x2="220" y2="55" stroke={INK} strokeWidth="1" strokeOpacity="0.35" />
      </svg>
    );
  }
  if (n === 1) {
    return (
      <svg viewBox="0 0 220 110" className="h-24 w-auto" aria-hidden="true">
        {[96, 80, 64, 48, 32].map((w, i) => (
          <rect key={w} x="0" y={i * 22} width={w * 2.2} height="14" fill={i === 4 ? RUST : INK} />
        ))}
      </svg>
    );
  }
  const lit = new Set([2, 9, 10, 17]);
  return (
    <svg viewBox="0 0 220 110" className="h-24 w-auto" aria-hidden="true">
      {Array.from({ length: 21 }).map((_, i) => {
        const x = (i % 7) * 32;
        const y = Math.floor(i / 7) * 36;
        return <rect key={i} x={x} y={y} width="26" height="26" fill={lit.has(i) ? RUST : 'none'} stroke={INK} strokeWidth="1.4" />;
      })}
    </svg>
  );
}

/** Many lines in, one line out: the purpose of the product, drawn. */
function ConvergeArt() {
  const ys = Array.from({ length: 13 }, (_, i) => 12 + i * 18);
  return (
    <svg viewBox="0 0 640 240" className="h-auto w-full" aria-hidden="true">
      {ys.map((y, i) => (
        <path key={y} d={`M0,${y} C260,${y} 340,120 520,120`} fill="none" stroke={PAPER} strokeOpacity={0.18 + (i % 4) * 0.08} strokeWidth="1.3" />
      ))}
      <line x1="520" y1="120" x2="640" y2="120" stroke={RUST} strokeWidth="6" />
      <circle cx="520" cy="120" r="9" fill={SOFT} />
    </svg>
  );
}

/** Large arcs for the closing band, cropped by the edge of the page. */
function ArcsArt() {
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden="true">
      {[60, 110, 160, 210, 260, 310].map((r, i) => (
        <circle key={r} cx="400" cy="400" r={r} fill="none" stroke={i === 2 ? RUST : PAPER} strokeOpacity={i === 2 ? 1 : 0.16} strokeWidth={i === 2 ? 5 : 1.2} />
      ))}
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
          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <Eyebrow>For recruitment agencies</Eyebrow>
              <h1 className="mt-6 font-serif text-[3rem] font-bold leading-[1.0] tracking-[-0.025em] sm:text-[4.7rem]">
                Run your agency with <span className="text-[#b4380a]">clarity.</span>
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
                    <span className="h-2 w-2 shrink-0 bg-[#b4380a]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute -bottom-4 -right-4 hidden h-full w-full border border-[#141414] sm:block" aria-hidden="true" />
              <div className="relative"><HeroArt /></div>
            </div>
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
              <div key={w.title} className="flex flex-col border-b border-[#d9d2c1] py-10 md:border-b-0 md:border-l md:px-8 md:first:border-l-0 md:first:pl-0">
                <WhyArt n={i as 0 | 1 | 2} />
                <span className="mt-10 font-serif text-[15px] font-bold tracking-[0.1em] text-[#b4380a]">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 font-serif text-[27px] font-bold leading-tight">{w.title}</h3>
                <p className="mt-3 text-[17px] leading-snug text-[#4a4538]">{w.text}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Purpose */}
      <section id="purpose" className="scroll-mt-16 overflow-hidden bg-[#141414] py-24 text-[#f6f3ec]">
        <Wrap>
          <Eyebrow light>Our purpose</Eyebrow>
          <H2 light className="max-w-4xl text-[2.4rem] sm:text-[4rem]">Built to give agencies their time back.</H2>
          <div className="mt-12 grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <p className="max-w-xl text-[19px] leading-snug text-[#cfc8b8]">
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
            <div>
              <ConvergeArt />
              <p className="mt-4 flex justify-between text-[12px] font-bold uppercase tracking-[0.2em] text-[#8a846f]">
                <span>Many places</span>
                <span className="text-[#e8956b]">One place</span>
              </p>
            </div>
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
          <div className="mt-14 grid gap-px bg-[#141414] sm:grid-cols-2 lg:grid-cols-3">
            {WHERE.map((w, i) => (
              <article key={w.title} className={`group relative flex min-h-[290px] flex-col justify-between overflow-hidden p-8 ${w.tone}`}>
                <div className="absolute inset-0 opacity-90 transition-transform duration-700 group-hover:scale-110" style={w.pattern} aria-hidden="true" />
                <span className="relative font-serif text-[64px] font-bold leading-none opacity-90">{String(i + 1).padStart(2, '0')}</span>
                <div className="relative">
                  <h3 className="font-serif text-[27px] font-bold leading-tight">{w.title}</h3>
                  <p className="mt-3 max-w-xs text-[16px] leading-snug opacity-85">{w.text}</p>
                </div>
              </article>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-16 border-y border-[#d9d2c1] bg-[#ebe5d6] py-24">
        <Wrap>
          <div className="max-w-2xl">
            <Eyebrow>Who it’s for</Eyebrow>
            <H2>Everyone gets what they need.</H2>
          </div>
          <div className="mt-14 grid border-t border-[#141414] sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.role} className="border-b border-[#cfc8b8] py-10 sm:border-r sm:px-7 sm:first:pl-0 lg:border-b-0 lg:last:border-r-0">
                <span className="block font-serif text-[120px] font-bold leading-[0.8] text-[#b4380a]/90">{r.letter}</span>
                <h3 className="mt-6 font-serif text-[26px] font-bold">{r.role}</h3>
                <p className="mt-2 text-[16px] leading-snug text-[#4a4538]">{r.gain}</p>
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
            {COMMITMENTS.map((c, i) => (
              <div key={c.title} className="bg-[#f6f3ec] p-8 md:p-10">
                <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true">
                  {i === 0 && <rect x="4" y="4" width="40" height="40" fill="none" stroke={INK} strokeWidth="2.4" />}
                  {i === 0 && <rect x="16" y="16" width="16" height="16" fill={RUST} />}
                  {i === 1 && <circle cx="24" cy="24" r="20" fill="none" stroke={INK} strokeWidth="2.4" />}
                  {i === 1 && <path d="M24 4 A20 20 0 0 1 24 44 Z" fill={RUST} />}
                  {i === 2 && <path d="M4 44 L24 4 L44 44 Z" fill="none" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />}
                  {i === 2 && <circle cx="24" cy="32" r="5" fill={RUST} />}
                </svg>
                <h3 className="mt-6 font-serif text-[25px] font-bold leading-tight">{c.title}</h3>
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
          <ol className="relative mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
            <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-[#141414] md:block" aria-hidden="true" />
            {START.map(([t, d], i) => (
              <li key={t} className="relative">
                <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#141414] bg-[#fbf9f4] font-serif text-[22px] font-bold">{i + 1}</span>
                <h3 className="mt-6 font-serif text-[25px] font-bold">{t}</h3>
                <p className="mt-2 max-w-xs text-[17px] leading-snug text-[#4a4538]">{d}</p>
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
      <section className="relative overflow-hidden bg-[#141414] py-28 text-[#f6f3ec]">
        <div className="pointer-events-none absolute -bottom-px -right-px h-[120%] w-[55%] max-w-[640px]" aria-hidden="true">
          <ArcsArt />
        </div>
        <Wrap className="relative">
          <Eyebrow light>Ready when you are</Eyebrow>
          <h2 className="mt-5 max-w-3xl font-serif text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-[4.2rem]">Stop chasing. Start placing.</h2>
          <p className="mt-5 max-w-xl text-[19px] leading-snug text-[#cfc8b8]">One workspace for your whole agency. Create an account and we will get back to you.</p>
          <div className="mt-10"><TryFree tone="dark" large /></div>
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
