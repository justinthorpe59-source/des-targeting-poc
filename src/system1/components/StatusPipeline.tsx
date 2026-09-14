import type { TargetStatus } from '../../store/system1Store'

const STAGES: TargetStatus[] = ['Modelled', 'Adjusted', 'Proposed', 'Approved']

/**
 * M14: a small, honest, hand-built component — not from react-bits.
 * react-bits' Stepper is an interactive multi-step form wizard (always
 * renders Back/Next/Complete controls with no way to fully suppress them);
 * forcing it into a passive, store-driven status display would either fight
 * the component with CSS or leave confusing buttons that don't actually
 * advance anything (Propose/Approve do that, on the buttons elsewhere on
 * this screen). Said so explicitly per the frontend-components skill rather
 * than silently building custom without checking first.
 *
 * Position-based: a status positionally before the current one renders as
 * "passed" even if that exact stage was skipped (e.g. Modelled straight to
 * Proposed) — standard stepper convention, and status is a single value,
 * not a visited-stages history.
 */
export function StatusPipeline({ current }: { current: TargetStatus }) {
  const currentIndex = STAGES.indexOf(current)

  return (
    <div className="flex items-center" data-testid="status-pipeline">
      {STAGES.map((stage, i) => {
        const isPast = i < currentIndex
        const isCurrent = i === currentIndex
        return (
          <div key={stage} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isCurrent
                    ? 'bg-slate-900 text-white'
                    : isPast
                      ? 'bg-slate-300 text-slate-700'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isPast ? '✓' : i + 1}
              </div>
              <span
                className={`text-[10px] font-medium uppercase tracking-wide ${
                  isCurrent ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {stage}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${isPast ? 'bg-slate-300' : 'bg-slate-100'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
