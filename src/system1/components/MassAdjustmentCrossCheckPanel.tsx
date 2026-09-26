import type { MassAdjustmentCrossCheckResult } from '../engine/massAdjustmentCrossCheck'
import { CheckStatusRow } from './CheckStatusRow'

/** Batch 3c: the Mass Adjustment counterpart to CrossCheckPanel — same badge/detail language, extended to a whole batch's individual breakdown and aggregate team/division/org effect. */

export function MassAdjustmentCrossCheckPanel({ result }: { result: MassAdjustmentCrossCheckResult }) {
  if (!result.hasOrgData) {
    return (
      <div className="rounded-pa-card bg-pa-white p-8 font-pa-body">
        <h2 className="text-sm font-semibold text-pa-grey-04">Real-time cross-check</h2>
        <p data-testid="mass-crosscheck-no-data" className="mt-2 text-sm text-pa-grey-03">
          Organisational data not yet available — cross-check skipped.
        </p>
        {result.outliers.length > 0 && (
          <p data-testid="mass-crosscheck-outliers-no-data" className="mt-3 rounded-pa-chip bg-pa-apricot-01 p-3 text-xs text-pa-grey-04">
            {result.outliers.length} of {result.perPerson.length} still route to Pending Sign-off on a drastic
            percentage change alone: {result.outliers.map((o) => o.person.id).join(', ')}.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-pa-card bg-pa-white p-8 font-pa-body">
      <h2 className="text-sm font-semibold text-pa-grey-04">Real-time cross-check</h2>

      <p data-testid="mass-crosscheck-summary" className="mt-2 text-sm text-pa-grey-03">
        {result.individualPassCount} of {result.perPerson.length} pass all three checks individually
        {result.individualFailCount > 0 && (
          <>
            ; {result.individualFailCount} fail at least one (team {result.failBreakdown.team}, cohort{' '}
            {result.failBreakdown.cohort}, org {result.failBreakdown.org} — a person can fail more than one)
          </>
        )}
        .
      </p>

      <div className="mt-3 border-t border-pa-grey-01 pt-2">
        <div className="text-xs font-medium uppercase tracking-wide text-pa-grey-03">
          Aggregate effect — everyone&apos;s change applied together
        </div>
        <div data-testid="mass-crosscheck-aggregate-groups" className="mt-1">
          {result.aggregateGroups.map((group) => (
            <CheckStatusRow
              key={group.key}
              testId={`mass-crosscheck-group-${group.key}`}
              label={group.label}
              status={group.status}
              detail={group.detail}
            />
          ))}
        </div>
      </div>

      {result.routing === 'whole-batch' && (
        <div data-testid="mass-crosscheck-whole-batch-banner" className="mt-3 rounded-pa-chip bg-pa-apricot-01 p-3 text-xs text-pa-grey-04">
          {/* WHY only. What happens next — routing, who approves, that it is
              still submittable — is stated once by the sign-off gate beside
              the confirm button, rather than twice on one screen. */}
          <p className="font-medium">Why the aggregate effect fails:</p>
          <ul className="mt-1 list-disc pl-4">
            {result.aggregateSignOffReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {result.routing === 'outliers-only' && (
        <div data-testid="mass-crosscheck-outliers-banner" className="mt-3 rounded-pa-chip bg-pa-apricot-01 p-3 text-xs text-pa-grey-04">
          <p className="font-medium">
            The aggregate effect is fine. These {result.outliers.length} fail on their own:
          </p>
          <ul className="mt-1 list-disc pl-4">
            {result.outliers.map((o) => (
              <li key={o.person.id}>
                {o.person.name} ({o.person.id}): {o.individual.signOffReasons.join(' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.routing === 'none' && (
        <p data-testid="mass-crosscheck-none-banner" className="mt-3 text-xs text-pa-grey-03">
          No sign-off required — the whole batch applies normally.
        </p>
      )}
    </div>
  )
}
