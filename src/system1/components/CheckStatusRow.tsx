import type { CheckStatus } from '../engine/overrideCrossCheck'

/**
 * Batch 3d: the pass/fail badge + label + detail row shared by
 * CrossCheckPanel, MassAdjustmentCrossCheckPanel, and the Sign-off Queue —
 * extracted so all three render the exact same check result the same way,
 * not three near-identical copies.
 */
export function CheckStatusRow({
  testId,
  label,
  status,
  detail,
}: {
  testId: string
  label: string
  status: CheckStatus
  detail: string
}) {
  return (
    <div className="flex items-start gap-2 border-b border-pa-grey-01 py-2 last:border-0">
      <span
        data-testid={`${testId}-badge`}
        data-status={status}
        className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-pa-body text-[10px] font-bold"
        /* Three states since 29 Sept 2026. 'note' is not a failure: the
           group was already non-compliant and this change does not worsen
           it. Neutral rather than green or red, so it reads as context. */
        style={
          status === 'pass'
            ? { background: 'var(--color-pa-lime-02)', color: 'var(--color-pa-lime-04)' }
            : status === 'note'
              ? { background: 'var(--color-pa-white)', border: '1px solid var(--color-pa-grey-02)', color: 'var(--color-pa-grey-03)' }
              : { background: 'var(--color-pa-rose-01)', color: 'var(--color-pa-rose-04)' }
        }
      >
        {status === 'pass' ? '✓' : status === 'note' ? 'i' : '✕'}
      </span>
      <div className="flex-1">
        <div className="font-pa-body text-sm font-medium text-pa-grey-04">{label}</div>
        <div data-testid={`${testId}-detail`} className="font-pa-body text-xs text-pa-grey-03">
          {detail}
        </div>
      </div>
    </div>
  )
}
