import { useSystem1Store } from '../../store/system1Store'

// M0 placeholder. Purely proves the plumbing: reads/writes the same shared
// value as Screen B, so navigating between them shows live updates. Gets
// replaced by a real screen starting M3.
export function ScreenA() {
  const demoValue = useSystem1Store((state) => state.demoValue)
  const setDemoValue = useSystem1Store((state) => state.setDemoValue)

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">Screen A (M0 placeholder)</h1>
      <p className="max-w-md text-sm text-slate-600">
        This number comes from the shared System 1 store. Change it here, then switch to Screen
        B — it should already show the new value, with no reload. Refresh the page and it should
        still be there.
      </p>
      <div className="flex items-center gap-3">
        <span data-testid="demo-value" className="text-3xl font-bold tabular-nums">
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
