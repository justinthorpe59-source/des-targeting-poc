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
  status: 'pass' | 'fail'
  detail: string
}) {
  return (
    <div className="flex items-start gap-2 border-b border-pa-grey-01 py-2 last:border-0">
      <span
        data-testid={`${testId}-badge`}
        data-status={status}
        className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-pa-body text-[10px] font-bold"
        style={
          status === 'pass'
            ? { background: 'var(--color-pa-lime-02)', color: 'var(--color-pa-lime-04)' }
            : { background: 'var(--color-pa-rose-01)', color: 'var(--color-pa-rose-04)' }
        }
      >
        {status === 'pass' ? '✓' : '✕'}
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
