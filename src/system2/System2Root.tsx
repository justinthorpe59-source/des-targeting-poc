// Placeholder so the top-level System 1 / System 2 switcher is real at M0,
// not itself a mockup. Real screens start at S2-M0, once System 1 has an
// Approved-only snapshot (M13) to feed in — System 2 never reads System 1's
// live data directly.
export function System2Root() {
  return (
    <section className="space-y-2">
      <h1 className="text-lg font-semibold">System 2 · Organisational Operating</h1>
      <p className="max-w-md text-sm text-slate-600">
        Not built yet. System 2 starts at milestone S2-M0, once System 1's snapshot export
        exists for it to ingest.
      </p>
    </section>
  )
}
