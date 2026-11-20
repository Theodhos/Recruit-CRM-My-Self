/**
 * What a page looks like before its data is there: a banner, a few cards. It is on the screen the moment a link is pressed, so
 * moving between pages never shows an empty page or the word "Loading…" — the real content takes its place as it arrives.
 */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading the page">
      <div className="flex items-center gap-4 rounded-xl border border-border border-l-4 bg-background px-5 py-4 shadow-sm">
        <div className="h-11 w-11 animate-pulse rounded-lg bg-accent" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-5 w-48 animate-pulse rounded bg-accent" />
          <div className="h-3.5 w-full max-w-xl animate-pulse rounded bg-accent/70" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-background" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="h-10 bg-accent/60" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-t border-border px-4 py-3.5">
            <div className="h-3.5 w-1/4 animate-pulse rounded bg-accent" />
            <div className="h-3.5 w-1/5 animate-pulse rounded bg-accent/70" />
            <div className="h-3.5 w-1/6 animate-pulse rounded bg-accent/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
