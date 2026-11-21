import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Recruitment CRM — One system for your agency',
  description: 'One calm place for your whole agency: your people, your roles and your clients, always in step.',
};

const REGISTER = '/register';

/* ───────────────────────── content ─────────────────────────
 * Deliberately high level: the page explains the idea, the purpose and where it helps, and nothing about how the
 * product is built, what screens or parts it has, or how anything works inside. Keep it that way when editing.
 * No invented figures, customers or quotes either: only claims the business can stand behind.
 * The pictures are drawn, plain "wireframe" scenes of everyday agency work (people, roles, clients). They show what
 * the product is for at a glance, with no real screens, labels or workflow in them.
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

const WHERE = [
  { title: 'Recruitment agencies', text: 'From a boutique of three to a busy floor of thirty.', tone: 'bg-[#141414] text-[#f6f3ec]' },
  { title: 'Staffing and temporary work', text: 'Fast-moving teams that have to keep up every single day.', tone: 'bg-[#b4380a] text-white' },
  { title: 'Specialist and executive search', text: 'Relationship-led work where nothing can slip through.', tone: 'bg-[#fbf9f4] text-[#141414] ring-1 ring-inset ring-[#d9d2c1]' },
  { title: 'Growing teams', text: 'A system that scales as quickly as you do.', tone: 'bg-[#ebe5d6] text-[#141414]' },
  { title: 'Multi-office agencies', text: 'Everyone on the same page, wherever they sit.', tone: 'bg-[#141414] text-[#f6f3ec]' },
  { title: 'In-house hiring teams', text: 'Companies that recruit for themselves and want it to feel easy.', tone: 'bg-[#fbf9f4] text-[#141414] ring-1 ring-inset ring-[#d9d2c1]' },
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

/* ───────────────────────── layout pieces ───────────────────────── */

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

/* ───────────────────────── drawing pieces ───────────────────────── */

/** A person: round head, rounded shoulders. Drawn at (x, y) as the centre of the head, r is the head radius. */
function Person({ x, y, r, fill, opacity = 1 }: { x: number; y: number; r: number; fill: string; opacity?: number }) {
  return (
    <g fill={fill} opacity={opacity}>
      <circle cx={x} cy={y} r={r} />
      <path d={`M${x - r * 1.9},${y + r * 3} C${x - r * 1.9},${y + r * 1.5} ${x - r * 1},${y + r * 1.25} ${x},${y + r * 1.25} C${x + r * 1},${y + r * 1.25} ${x + r * 1.9},${y + r * 1.5} ${x + r * 1.9},${y + r * 3} Z`} />
    </g>
  );
}

/** A line of text, drawn as a bar. */
function Bar({ x, y, w, h = 6, fill = INK, opacity = 0.2 }: { x: number; y: number; w: number; h?: number; fill?: string; opacity?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} opacity={opacity} />;
}

/**
 * The hero picture: an agency's day in one calm window. People on the left, open roles on the right, one of them
 * matched. Plain wireframe, no real screen, labels or workflow.
 */
function HeroArt() {
  const people = [0, 1, 2, 3];
  const roles = [0, 1, 2];
  return (
    <svg viewBox="0 0 600 440" className="h-auto w-full" role="img" aria-label="">
      <rect x="1" y="1" width="598" height="438" rx="12" fill="#fbf9f4" stroke={INK} strokeWidth="1.4" />
      {/* window bar */}
      <path d="M1,13 A12,12 0 0 1 13,1 H587 A12,12 0 0 1 599,13 V37 H1 Z" fill={SAND} />
      {[22, 40, 58].map((cx) => (
        <circle key={cx} cx={cx} cy="19" r="4.5" fill={INK} opacity="0.28" />
      ))}
      <rect x="200" y="11" width="200" height="16" rx="8" fill={PAPER} />
      {/* side column */}
      <rect x="1" y="37" width="124" height="402" fill="#f1ece0" />
      <rect x="18" y="56" width="26" height="26" rx="7" fill={RUST} />
      <Bar x={52} y={64} w={52} h={8} opacity={0.7} />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          {i === 1 && <rect x="1" y={108 + i * 40 - 11} width="124" height="34" fill={PAPER} />}
          {i === 1 && <rect x="1" y={108 + i * 40 - 11} width="4" height="34" fill={RUST} />}
          <rect x="22" y={108 + i * 40} width="12" height="12" rx="3" fill={INK} opacity={i === 1 ? 0.7 : 0.25} />
          <Bar x={44} y={110 + i * 40} w={i % 2 ? 56 : 44} h={7} opacity={i === 1 ? 0.6 : 0.22} />
        </g>
      ))}
      {/* heading and three summary tiles */}
      <Bar x={150} y={58} w={170} h={11} opacity={0.85} />
      <Bar x={150} y={78} w={110} h={6} opacity={0.25} />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${150 + i * 148} 100)`}>
          <rect width="136" height="74" rx="8" fill={PAPER} stroke={INK} strokeOpacity="0.2" />
          <Bar x={14} y={14} w={44} h={6} opacity={0.3} />
          {i === 0 &&
            [0, 1, 2, 3, 4, 5].map((b) => <rect key={b} x={14 + b * 17} y={64 - (14 + b * 6)} width="11" height={14 + b * 6} fill={b === 5 ? RUST : INK} opacity={b === 5 ? 1 : 0.8} />)}
          {i === 1 && (
            <>
              <circle cx="46" cy="46" r="18" fill="none" stroke={INK} strokeOpacity="0.15" strokeWidth="7" />
              <circle cx="46" cy="46" r="18" fill="none" stroke={RUST} strokeWidth="7" strokeDasharray="82 113" transform="rotate(-90 46 46)" />
              <Bar x={78} y={38} w={40} h={8} opacity={0.8} />
              <Bar x={78} y={54} w={28} h={5} opacity={0.25} />
            </>
          )}
          {i === 2 && (
            <>
              <path d="M14,58 L40,44 L62,50 L86,30 L120,22" fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx="120" cy="22" r="4.5" fill={RUST} />
            </>
          )}
        </g>
      ))}
      {/* people */}
      <text x="150" y="204" fontSize="11" fontWeight="700" letterSpacing="2" fill={INK} opacity="0.55">PEOPLE</text>
      {people.map((i) => (
        <g key={i} transform={`translate(150 ${214 + i * 54})`}>
          <rect width="190" height="46" rx="8" fill={i === 1 ? PAPER : 'none'} stroke={i === 1 ? RUST : INK} strokeOpacity={i === 1 ? 1 : 0.2} strokeWidth={i === 1 ? 1.8 : 1} />
          <circle cx="24" cy="23" r="14" fill={['#cfc8b8', RUST, SOFT, '#b9b19b'][i]} />
          <circle cx="24" cy="19" r="5" fill={PAPER} opacity="0.9" />
          <path d="M14,31 C14,26 34,26 34,31 Z" fill={PAPER} opacity="0.9" />
          <Bar x={50} y={12} w={90} h={7} opacity={0.75} />
          <Bar x={50} y={26} w={60} h={5} opacity={0.25} />
          <rect x={150} y={15} width={28} height={16} rx={8} fill={i === 1 ? RUST : INK} opacity={i === 1 ? 1 : 0.15} />
        </g>
      ))}
      {/* roles */}
      <text x="372" y="204" fontSize="11" fontWeight="700" letterSpacing="2" fill={INK} opacity="0.55">ROLES</text>
      {roles.map((i) => (
        <g key={i} transform={`translate(372 ${214 + i * 66})`}>
          <rect width="214" height="56" rx="8" fill={i === 0 ? PAPER : 'none'} stroke={i === 0 ? RUST : INK} strokeOpacity={i === 0 ? 1 : 0.2} strokeWidth={i === 0 ? 1.8 : 1} />
          <Bar x={16} y={14} w={i === 1 ? 110 : 140} h={8} opacity={0.75} />
          <Bar x={16} y={28} w={84} h={5} opacity={0.25} />
          <rect x="16" y="42" width="182" height="5" rx="2.5" fill={INK} opacity="0.1" />
          <rect x="16" y="42" width={[150, 96, 52][i]} height="5" rx="2.5" fill={RUST} />
        </g>
      ))}
      {/* the match */}
      <path d="M340,290 C356,290 356,242 372,242" fill="none" stroke={RUST} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="372" cy="242" r="4.5" fill={RUST} />
      <circle cx="340" cy="290" r="4.5" fill={RUST} />
    </svg>
  );
}

/** One small scene for each reason: an overview, work taken care of, and who sees what. */
function WhyArt({ n }: { n: 0 | 1 | 2 }) {
  return (
    <svg viewBox="0 0 240 150" className="h-auto w-full max-w-[340px] sm:max-w-[260px]" aria-hidden="true">
      <rect x="1" y="1" width="238" height="148" rx="10" fill="#fbf9f4" stroke={INK} strokeOpacity="0.45" strokeWidth="1.2" />
      {n === 0 && (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${14 + i * 74} 14)`}>
              <rect width="66" height="38" rx="6" fill={PAPER} stroke={INK} strokeOpacity="0.18" />
              <Bar x={9} y={9} w={26} h={5} opacity={0.3} />
              <Bar x={9} y={21} w={i === 1 ? 40 : 30} h={9} fill={i === 2 ? RUST : INK} opacity={i === 2 ? 1 : 0.8} />
            </g>
          ))}
          {[22, 34, 28, 48, 40, 58, 70].map((h, i) => (
            <rect key={i} x={20 + i * 30} y={134 - h} width="20" height={h} fill={i === 6 ? RUST : INK} opacity={i === 6 ? 1 : 0.78} />
          ))}
        </>
      )}
      {n === 1 &&
        [0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(20 ${20 + i * 30})`}>
            <rect width="18" height="18" rx="4" fill={i < 3 ? RUST : 'none'} stroke={i < 3 ? RUST : INK} strokeOpacity={i < 3 ? 1 : 0.5} strokeWidth="1.6" />
            {i < 3 && <path d="M4.5,9.5 L8,13 L14,5.5" fill="none" stroke={PAPER} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
            <Bar x={32} y={4} w={[132, 108, 150, 96][i]!} h={8} opacity={i < 3 ? 0.25 : 0.75} />
            {i < 3 && <rect x={32} y={7.5} width={[132, 108, 150, 96][i]!} height="1.4" fill={INK} opacity="0.5" />}
          </g>
        ))}
      {n === 2 &&
        [0, 1, 2].map((i) => (
          <g key={i} transform={`translate(18 ${18 + i * 42})`}>
            <circle cx="14" cy="14" r="14" fill={['#cfc8b8', RUST, SOFT][i]} />
            <circle cx="14" cy="11" r="4.5" fill={PAPER} opacity="0.9" />
            <path d="M6,22 C6,17 22,17 22,22 Z" fill={PAPER} opacity="0.9" />
            <Bar x={38} y={5} w={78} h={7} opacity={0.75} />
            <Bar x={38} y={18} w={50} h={5} opacity={0.25} />
            <rect x="160" y="4" width="46" height="24" rx="12" fill={i === 1 ? INK : RUST} opacity={i === 1 ? 0.18 : 1} />
            <circle cx={i === 1 ? 172 : 194} cy="16" r="9" fill={PAPER} />
          </g>
        ))}
    </svg>
  );
}

/** The purpose, drawn: notes, sheets, mail and chat scattered on the left, one tidy view on the right. */
function ConvergeArt() {
  return (
    <svg viewBox="0 0 640 280" className="h-auto w-full" aria-hidden="true">
      {/* scattered things */}
      <g transform="translate(14 22) rotate(-7 50 40)">
        <rect width="104" height="84" fill={PAPER} opacity="0.95" />
        {[0, 1, 2, 3].map((r) => (
          <line key={r} x1="0" y1={21 + r * 21} x2="104" y2={21 + r * 21} stroke={INK} strokeOpacity="0.3" />
        ))}
        {[0, 1, 2].map((c) => (
          <line key={c} x1={26 + c * 26} y1="0" x2={26 + c * 26} y2="84" stroke={INK} strokeOpacity="0.3" />
        ))}
        <rect x="26" y="0" width="26" height="21" fill={RUST} opacity="0.85" />
      </g>
      <g transform="translate(138 8) rotate(5 50 30)">
        <rect width="100" height="66" fill="#d9d2c1" />
        <path d="M0,0 L50,38 L100,0" fill="none" stroke={INK} strokeOpacity="0.5" strokeWidth="1.6" />
        <circle cx="86" cy="54" r="9" fill={RUST} />
      </g>
      <g transform="translate(40 142) rotate(4 50 40)">
        <rect width="98" height="88" fill={SOFT} />
        <Bar x={12} y={16} w={66} h={6} fill={INK} opacity={0.55} />
        <Bar x={12} y={32} w={50} h={6} fill={INK} opacity={0.55} />
        <Bar x={12} y={48} w={72} h={6} fill={INK} opacity={0.55} />
      </g>
      <g transform="translate(160 128) rotate(-5 60 40)">
        <rect width="104" height="46" rx="14" fill={PAPER} opacity="0.95" />
        <path d="M18,46 L12,62 L36,46 Z" fill={PAPER} opacity="0.95" />
        <Bar x={16} y={15} w={72} h={6} opacity={0.4} />
        <Bar x={16} y={28} w={46} h={6} opacity={0.4} />
      </g>
      <g transform="translate(178 200) rotate(3 40 20)">
        <rect width="88" height="50" rx="14" fill="#cfc8b8" />
        <Bar x={14} y={16} w={56} h={6} opacity={0.5} />
        <Bar x={14} y={29} w={36} h={6} opacity={0.5} />
      </g>
      {/* many into one */}
      {([[118, 60], [238, 112], [130, 168], [266, 226]] as const).map(([x, y]) => (
        <path key={y} d={`M${x},${y} C330,${y} 330,140 392,140`} fill="none" stroke={PAPER} strokeOpacity="0.5" strokeWidth="1.4" strokeDasharray="4 5" />
      ))}
      <circle cx="392" cy="140" r="6" fill={SOFT} />
      {/* the one view */}
      <g transform="translate(404 28)">
        <rect width="226" height="224" rx="10" fill="#fbf9f4" />
        <path d="M0,10 A10,10 0 0 1 10,0 H216 A10,10 0 0 1 226,10 V28 H0 Z" fill={SAND} />
        {[16, 30, 44].map((cx) => (
          <circle key={cx} cx={cx} cy="14" r="3.5" fill={INK} opacity="0.28" />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(14 ${42 + i * 44})`}>
            <rect width="198" height="36" rx="7" fill="none" stroke={i === 0 ? RUST : INK} strokeOpacity={i === 0 ? 1 : 0.22} strokeWidth={i === 0 ? 1.8 : 1} />
            <circle cx="20" cy="18" r="11" fill={['#cfc8b8', RUST, SOFT, '#b9b19b'][i]} />
            <Bar x={42} y={9} w={78} h={7} opacity={0.75} />
            <Bar x={42} y={21} w={50} h={5} opacity={0.25} />
            <rect x="152" y="10" width="34" height="16" rx="8" fill={i === 0 ? RUST : INK} opacity={i === 0 ? 1 : 0.14} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** A small scene for each kind of place the product helps. Drawn in the colour of the tile it sits on. */
function WhereArt({ n }: { n: number }) {
  /** A person drawn in the tile's colour; (x, y) is the centre of the head. */
  const dot = (x: number, y: number, r: number, key: string | number, o = 0.9) => <Person key={key} x={x} y={y} r={r} fill="currentColor" opacity={o} />;
  return (
    <svg viewBox="0 0 200 96" className="h-auto w-full" aria-hidden="true" fill="none" stroke="currentColor">
      {n === 0 && (
        <>
          {[14, 44, 74].map((y, i) => (
            <g key={y}>
              {dot(26, y + 3, 7, `p${i}`)}
              <rect x="128" y={y - 2} width="58" height="22" rx="5" strokeOpacity="0.8" strokeWidth="1.5" />
              <line x1="136" y1={y + 9} x2={156 + i * 8} y2={y + 9} strokeOpacity="0.8" strokeWidth="3" strokeLinecap="round" />
            </g>
          ))}
          <path d="M46,24 C86,24 88,84 126,84 M46,54 C86,54 88,24 126,24 M46,84 C86,84 88,54 126,54" strokeOpacity="0.55" strokeWidth="1.4" strokeDasharray="3 4" />
        </>
      )}
      {n === 1 && (
        <>
          {Array.from({ length: 21 }).map((_, i) => {
            const x = 8 + (i % 7) * 26;
            const y = 6 + Math.floor(i / 7) * 30;
            const on = [0, 1, 4, 8, 9, 10, 15, 16, 19, 20].includes(i);
            return <rect key={i} x={x} y={y} width="22" height="24" rx="4" fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.85 : 0} strokeOpacity="0.55" strokeWidth="1.2" />;
          })}
        </>
      )}
      {n === 2 && (
        <>
          {[[30, 20], [170, 20], [30, 76], [170, 76]].map(([x, y], i) => (
            <g key={i}>
              <line x1="100" y1="48" x2={x} y2={y} strokeOpacity="0.5" strokeWidth="1.4" />
              {dot(x as number, (y as number) - 6, 6, `s${i}`, 0.75)}
            </g>
          ))}
          <circle cx="100" cy="48" r="24" fill="currentColor" fillOpacity="0.12" strokeOpacity="0.6" />
          {dot(100, 38, 9, 'c')}
        </>
      )}
      {n === 3 && (
        <>
          <line x1="6" y1="88" x2="194" y2="88" strokeOpacity="0.5" strokeWidth="1.4" />
          {Array.from({ length: 8 }).map((_, k) => {
            const r = 4 + k * 0.55;
            return dot(18 + k * 23.5, 86 - r * 3, r, `g${k}`, 0.5 + k * 0.07);
          })}
        </>
      )}
      {n === 4 && (
        <>
          <circle cx="100" cy="12" r="6" fill="currentColor" />
          {[36, 100, 164].map((x, i) => (
            <g key={x}>
              <line x1="100" y1="18" x2={x} y2="44" strokeOpacity="0.5" strokeWidth="1.4" />
              <rect x={x - 28} y="44" width="56" height="46" rx="4" strokeOpacity="0.8" strokeWidth="1.5" />
              {[0, 1, 2].map((p) => dot(x - 16 + p * 16, 60, 4.6, `${i}-${p}`))}
            </g>
          ))}
        </>
      )}
      {n === 5 && (
        <>
          <rect x="10" y="16" width="56" height="74" rx="4" strokeOpacity="0.8" strokeWidth="1.5" />
          {[0, 1, 2, 3, 4, 5].map((w) => (
            <rect key={w} x={19 + (w % 2) * 24} y={26 + Math.floor(w / 2) * 20} width="14" height="12" fill="currentColor" fillOpacity="0.5" stroke="none" />
          ))}
          <line x1="74" y1="53" x2="104" y2="53" strokeOpacity="0.6" strokeWidth="1.6" strokeDasharray="3 4" />
          {[0, 1, 2, 3].map((p) => dot(124 + p * 21, 40, 7, `h${p}`, 0.85))}
        </>
      )}
    </svg>
  );
}

/** Three small scenes for the commitments: two separate rooms, access you choose, and a person helping. */
function CommitmentArt({ n }: { n: 0 | 1 | 2 }) {
  return (
    <svg viewBox="0 0 160 90" className="h-20 w-auto" aria-hidden="true">
      {n === 0 && (
        <>
          <rect x="1" y="4" width="68" height="82" rx="6" fill="none" stroke={INK} strokeWidth="1.6" />
          <rect x="91" y="4" width="68" height="82" rx="6" fill="none" stroke={RUST} strokeWidth="1.6" />
          <line x1="80" y1="0" x2="80" y2="90" stroke={INK} strokeOpacity="0.4" strokeDasharray="3 4" />
          <Person x={35} y={30} r={9} fill={INK} opacity={0.85} />
          <Bar x={14} y={66} w={42} h={6} opacity={0.3} />
          <Person x={125} y={30} r={9} fill={RUST} />
          <Bar x={104} y={66} w={42} h={6} fill={RUST} opacity={0.4} />
        </>
      )}
      {n === 1 &&
        [0, 1].map((i) => (
          <g key={i} transform={`translate(2 ${6 + i * 42})`}>
            <Person x={14} y={10} r={8} fill={i === 0 ? RUST : INK} opacity={i === 0 ? 1 : 0.5} />
            <Bar x={38} y={8} w={60} h={7} opacity={0.6} />
            <Bar x={38} y={22} w={38} h={5} opacity={0.25} />
            <rect x="110" y="6" width="46" height="24" rx="12" fill={i === 0 ? RUST : INK} opacity={i === 0 ? 1 : 0.18} />
            <circle cx={i === 0 ? 144 : 122} cy="18" r="9" fill={PAPER} />
          </g>
        ))}
      {n === 2 && (
        <>
          <Person x={34} y={30} r={13} fill={INK} opacity={0.85} />
          <rect x="66" y="10" width="92" height="46" rx="14" fill="none" stroke={RUST} strokeWidth="1.8" />
          <path d="M80,56 L74,72 L98,56 Z" fill={PAPER} stroke={RUST} strokeWidth="1.8" strokeLinejoin="round" />
          <Bar x={80} y={24} w={64} h={6} fill={RUST} opacity={0.7} />
          <Bar x={80} y={38} w={40} h={6} fill={RUST} opacity={0.45} />
        </>
      )}
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
      <section className="pb-14 pt-10 sm:pb-20 sm:pt-14 lg:pb-28 lg:pt-20">
        <Wrap>
          <div className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
            <div>
              <Eyebrow>For recruitment agencies</Eyebrow>
              <h1 className="mt-6 font-serif text-[3rem] font-bold leading-[1.0] tracking-[-0.025em] sm:text-[4.4rem]">
                Your people, your roles, your clients. <span className="text-[#b4380a]">One place.</span>
              </h1>
              <p className="mt-7 max-w-xl text-[20px] leading-[1.45] text-[#4a4538]">
                Recruitment CRM keeps your whole agency in step: who you work with, what needs filling, and where everything stands.
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
              <div className="relative shadow-[0_30px_60px_-34px_rgba(20,20,20,0.55)]"><HeroArt /></div>
            </div>
          </div>
        </Wrap>
      </section>

      {/* Why */}
      <section id="why" className="scroll-mt-16 border-y border-[#d9d2c1] bg-[#fbf9f4] py-16 sm:py-24">
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
          <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
            {WHY.map((w, i) => (
              <div key={w.title}>
                <WhyArt n={i as 0 | 1 | 2} />
                <h3 className="mt-8 border-t border-[#141414] pt-5 font-serif text-[27px] font-bold leading-tight">{w.title}</h3>
                <p className="mt-3 text-[17px] leading-snug text-[#4a4538]">{w.text}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Purpose */}
      <section id="purpose" className="scroll-mt-16 overflow-hidden bg-[#141414] py-16 sm:py-24 text-[#f6f3ec]">
        <Wrap>
          <Eyebrow light>Our purpose</Eyebrow>
          <H2 light className="max-w-4xl text-[2.4rem] sm:text-[4rem]">Built to give agencies their time back.</H2>
          <div className="mt-12 grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
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
                <span><span className="sm:hidden">Scattered</span><span className="hidden sm:inline">Notes, sheets, inboxes, chats</span></span>
                <span className="text-[#e8956b]">One place</span>
              </p>
            </div>
          </div>
        </Wrap>
      </section>

      {/* Where it helps */}
      <section id="where" className="scroll-mt-16 py-16 sm:py-24">
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
              <article key={w.title} className={`flex min-h-[270px] flex-col justify-between gap-6 p-6 sm:min-h-[320px] sm:gap-8 sm:p-8 ${w.tone}`}>
                <div className="max-w-[260px]"><WhereArt n={i} /></div>
                <div>
                  <h3 className="font-serif text-[27px] font-bold leading-tight">{w.title}</h3>
                  <p className="mt-3 max-w-xs text-[16px] leading-snug opacity-85">{w.text}</p>
                </div>
              </article>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-16 border-y border-[#d9d2c1] bg-[#ebe5d6] py-16 sm:py-24">
        <Wrap>
          <div className="max-w-2xl">
            <Eyebrow>Who it’s for</Eyebrow>
            <H2>Everyone gets what they need.</H2>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 border-t border-[#141414] pt-10 sm:mt-14 lg:grid-cols-4 lg:gap-x-8">
            {ROLES.map((r) => (
              <div key={r.role}>
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#f6f3ec]">
                  <Image src={r.src} alt={r.alt} fill sizes="(min-width: 1024px) 264px, (min-width: 640px) 45vw, 46vw" className="object-cover object-top" />
                </div>
                <h3 className="mt-4 border-t border-[#141414] pt-3 font-serif text-[21px] font-bold sm:mt-5 sm:text-[25px]">{r.role}</h3>
                <p className="mt-1.5 text-[14.5px] leading-snug text-[#4a4538] sm:text-[16px]">{r.gain}</p>
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
              <div key={c.title} className="bg-[#f6f3ec] p-6 sm:p-8 md:p-10">
                <CommitmentArt n={i as 0 | 1 | 2} />
                <h3 className="mt-6 font-serif text-[25px] font-bold leading-tight">{c.title}</h3>
                <p className="mt-3 text-[17px] leading-snug text-[#4a4538]">{c.text}</p>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Get started */}
      <section className="border-y border-[#d9d2c1] bg-[#fbf9f4] py-16 sm:py-24">
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
      <section id="faq" className="scroll-mt-16 py-16 sm:py-24">
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
      <section className="bg-[#141414] py-16 sm:py-24 text-[#f6f3ec]">
        <Wrap>
          <div className="grid items-end gap-10 lg:grid-cols-[1.4fr_0.6fr] lg:gap-16">
            <div>
              <Eyebrow light>Ready when you are</Eyebrow>
              <h2 className="mt-5 font-serif text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-[4.2rem]">Stop chasing. Start placing.</h2>
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
