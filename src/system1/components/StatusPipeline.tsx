import type { TargetStatus } from '../../store/system1Store'

// Full workflow order, including Pending Sign-off — a record in that state
// previously fell off the pipeline (indexOf === -1 → nothing highlighted),
// exactly the records that also show the Pending Sign-off banner.
const STAGES: TargetStatus[] = ['Modelled', 'Adjusted', 'Pending Sign-off', 'Proposed', 'Approved']

const STAGE_LABEL: Record<TargetStatus, string> = {
  Modelled: 'Modelled',
  Adjusted: 'Adjusted',
  'Pending Sign-off': 'Sign-off',
  Proposed: 'Proposed',
  Approved: 'Approved',
}

/**
 * A small, hand-built status pipeline (not react-bits — its Stepper is an
 * interactive form wizard with unsuppressable controls). Position-based: a
 * status positionally before the current one renders as "passed". Searchlight
 * design pass: migrated off the old slate palette onto PA tokens.
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
                className={`flex h-6 w-6 items-center justify-center rounded-full font-pa-mono text-xs font-semibold transition-colors ${
                  isCurrent
                    ? 'bg-pa-aqua-05 text-pa-white'
                    : isPast
                      ? 'bg-pa-aqua-02 text-pa-aqua-05'
                      : 'bg-pa-grey-01 text-pa-grey-03'
                }`}
              >
                {isPast ? '✓' : i + 1}
              </div>
              <span
                className={`font-pa-body text-[10px] font-medium uppercase tracking-wide ${
                  isCurrent ? 'text-pa-grey-04' : 'text-pa-grey-03'
                }`}
              >
                {STAGE_LABEL[stage]}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${isPast ? 'bg-pa-aqua-02' : 'bg-pa-grey-01'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
