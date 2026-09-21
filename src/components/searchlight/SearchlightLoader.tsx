/**
 * Searchlight-beam sweep loading state for Executive Summary's initial load
 * (Searchlight design pass). A rotating conic-gradient cone inside a fixed
 * outer wrapper — the wrapper owns the static centering transform, the
 * inner cone owns the animated rotate, so the two transforms never fight.
 * Respects prefers-reduced-motion globally (src/index.css).
 */
export function SearchlightLoader() {
  return (
    <div className="relative flex h-[360px] items-center justify-center overflow-hidden rounded-xl bg-pa-aqua-05">
      <div className="absolute left-[-10%] top-1/2 h-[160%] w-[70%] -translate-y-1/2">
        <div
          className="h-full w-full origin-left animate-[pa-searchlight-rotate_2.6s_ease-in-out_infinite]"
          style={{
            background:
              'conic-gradient(from -18deg, transparent 0deg, rgba(74,185,211,0.45) 16deg, rgba(183,229,238,0.16) 24deg, transparent 40deg)',
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_35%,rgba(2,77,120,0.6)_100%)]" />
      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        <span className="font-pa-mono text-[11px] uppercase tracking-[0.35em] text-pa-aqua-02">Searchlight</span>
        <span className="font-pa-display text-sm text-pa-grey-01">Scanning the DES-wide position…</span>
      </div>
    </div>
  )
}
