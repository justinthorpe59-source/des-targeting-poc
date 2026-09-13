import { useSystem1Store } from '../../store/system1Store'

// M0 placeholder — same shared value as Screen A, different mutation, to make
// it visibly a distinct screen while proving the state really is shared.
export function ScreenB() {
  const demoValue = useSystem1Store((state) => state.demoValue)
  const setDemoValue = useSystem1Store((state) => state.setDemoValue)

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">Screen B (M0 placeholder)</h1>
      <p className="max-w-md text-sm text-slate-600">
        Same shared value as Screen A, read from the same store. If this doesn't match what you
        last set on Screen A, the shared state isn't wired up correctly.
      </p>
      <div className="flex items-center gap-3">
        <span data-testid="demo-value" className="text-3xl font-bold tabular-nums">
          {demoValue}
        </span>
        <button
          type="button"
          onClick={() => setDemoValue(demoValue - 1)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          −1 from Screen B
        </button>
      </div>
    </section>
  )
}
