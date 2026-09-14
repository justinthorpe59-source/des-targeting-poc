import { useSystem2Store } from '../../store/system2Store'

// S2-M0 placeholder — mirrors System 1's original M0 ScreenA exactly: proves
// the plumbing (a value shared across screens within System 2's own store,
// persisted to its own localStorage key, isolated from System 1's) before
// any real screen exists. Gets replaced by a real screen starting S2-M4.
export function ScreenA() {
  const demoValue = useSystem2Store((state) => state.demoValue)
  const setDemoValue = useSystem2Store((state) => state.setDemoValue)

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">Screen A (S2-M0 placeholder)</h1>
      <p className="max-w-md text-sm text-slate-600">
        This number comes from System 2's own store — separate from System 1's. Change it here, then
        switch to Screen B — it should already show the new value, with no reload. Switch to System 1 and
        back — this value should be untouched.
      </p>
      <div className="flex items-center gap-3">
        <span data-testid="s2-demo-value" className="text-3xl font-bold tabular-nums">
          {demoValue}
        </span>
        <button
          type="button"
          onClick={() => setDemoValue(demoValue + 1)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          +1 from Screen A
        </button>
      </div>
    </section>
  )
}
