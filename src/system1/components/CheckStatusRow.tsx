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
    <div className="flex items-start gap-2 border-b border-slate-100 py-2 last:border-0">
      <span
        data-testid={`${testId}-badge`}
        data-status={status}
        className={`mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
          status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {status === 'pass' ? '✓' : '✕'}
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div data-testid={`${testId}-detail`} className="text-xs text-slate-500">
          {detail}
        </div>
      </div>
    </div>
  )
}
