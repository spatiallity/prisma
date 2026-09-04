/**
 * Every page under (app) fetches its data server-side with no client-side
 * cache — until now, that meant a blank tab on every navigation for however
 * long the DB round-trip took, since nothing here ever gave Next a stream
 * boundary to show instant feedback through. This fallback covers the whole
 * authenticated shell (layout's own requireUser() call included), so a nav
 * click paints something immediately instead of sitting frozen.
 */
export default function AppLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-muted">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary"
          aria-hidden
        />
        <span className="text-xs font-bold tracking-wide text-muted-foreground">
          Memuat…
        </span>
      </div>
    </div>
  )
}
