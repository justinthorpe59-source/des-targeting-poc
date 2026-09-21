import { Link } from 'react-router-dom'
import type { MassAdjustmentCrossCheckResult } from '../engine/massAdjustmentCrossCheck'
import { CheckStatusRow } from './CheckStatusRow'

/** Batch 3c: the Mass Adjustment counterpart to CrossCheckPanel — same badge/detail language, extended to a whole batch's individual breakdown and aggregate team/division/org effect. */

export function MassAdjustmentCrossCheckPanel({ result }: { result: MassAdjustmentCrossCheckResult }) {
  if (!result.hasOrgData) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Real-time cross-check</h2>
        <p data-testid="mass-crosscheck-no-data" className="mt-2 text-sm text-slate-500">
          Organisational data not yet available — cross-check skipped.
        </p>
        {result.outliers.length > 0 && (
          <p data-testid="mass-crosscheck-outliers-no-data" className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            {result.outliers.length} of {result.perPerson.length} still route to Pending Sign-off on a drastic
            percentage change alone: {result.outliers.map((o) => o.person.id).join(', ')}.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Real-time cross-check</h2>

      <p data-testid="mass-crosscheck-summary" className="mt-2 text-sm text-slate-600">
        {result.individualPassCount} of {result.perPerson.length} pass all three checks individually
        {result.individualFailCount > 0 && (
          <>
            ; {result.individualFailCount} fail at least one (team {result.failBreakdown.team}, cohort{' '}
            {result.failBreakdown.cohort}, org {result.failBreakdown.org} — a person can fail more than one)
          </>
        )}
        .
      </p>

      <div className="mt-3 border-t border-slate-100 pt-2">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
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
        <div data-testid="mass-crosscheck-whole-batch-banner" className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-medium">
            The aggregate effect of this batch requires sign-off — all {result.perPerson.length} affected records
            will route to Pending Sign-off, not just the outliers below.
          </p>
          <ul className="mt-1 list-disc pl-4">
            {result.aggregateSignOffReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="mt-2">
            Once applied, it&apos;ll appear in the{' '}
            <Link to="/system1/signoff" className="font-medium underline">
              Sign-off Queue →
            </Link>
          </p>
        </div>
      )}

      {result.routing === 'outliers-only' && (
        <div data-testid="mass-crosscheck-outliers-banner" className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-medium">
            The aggregate effect is fine — only {result.outliers.length} of {result.perPerson.length} route to
            Pending Sign-off individually; the rest apply normally.
          </p>
          <ul className="mt-1 list-disc pl-4">
            {result.outliers.map((o) => (
              <li key={o.person.id}>
                {o.person.name} ({o.person.id}): {o.individual.signOffReasons.join(' ')}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Once applied, they&apos;ll appear in the{' '}
            <Link to="/system1/signoff" className="font-medium underline">
              Sign-off Queue →
            </Link>
          </p>
        </div>
      )}

      {result.routing === 'none' && (
        <p data-testid="mass-crosscheck-none-banner" className="mt-3 text-xs text-slate-500">
          No sign-off required — the whole batch applies normally.
        </p>
      )}
    </div>
  )
}
