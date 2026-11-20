import Link from 'next/link';

const PROMISES = [
  ['Together', 'Everything in one calm place.'],
  ['Clear', 'Always in the picture.'],
  ['Simple', 'Less admin, more focus.'],
];

/** Every page before the CRM (sign in, register, password reset) shares this split: why on the left, the form on the right.
 * Kept deliberately high level: it never names the product's parts or how they work. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full bg-[#f6f3ec] text-[#141414] lg:grid-cols-[0.85fr_1.15fr]">
      <aside className="flex flex-col justify-between bg-[#141414] px-8 py-10 text-[#f6f3ec] sm:px-12 lg:px-14 lg:py-14">
        <Link href="/" className="font-serif text-[22px] font-bold tracking-tight">
          Recruitment CRM
        </Link>

        <div className="my-12 lg:my-0">
          <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#f08a5d]">Your agency, one system</p>
          <p className="mt-4 font-serif text-[2.4rem] font-bold leading-[1.04] tracking-tight sm:text-[3.2rem]">
            Run your agency
            <span className="block text-[#f08a5d]">with clarity.</span>
          </p>
          <dl className="mt-10 border-t border-white/20">
            {PROMISES.map(([k, v]) => (
              <div key={k} className="grid gap-1 border-b border-white/20 py-4 sm:grid-cols-[120px_1fr] sm:gap-6">
                <dt className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#f08a5d]">{k}</dt>
                <dd className="text-[16px] text-[#d6d0be]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="hidden text-[14px] text-[#8a846f] lg:block">Recruitment CRM</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 sm:px-12">{children}</main>
    </div>
  );
}
