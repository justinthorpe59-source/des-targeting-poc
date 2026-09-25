import { Link } from 'react-router-dom'
import type { OverrideCrossCheckResult } from '../engine/overrideCrossCheck'
import { CheckStatusRow } from './CheckStatusRow'

/**
 * Batch 3b: the live pass/fail + numeric-effect display for the real-time
 * cross-check, shared here so a later screen (Mass Adjustment, Batch 3c)
 * wires the same panel to the same engine rather than building a second
 * one.
 *
 * Verification pass: `division` is rendered as a fourth row, labelled
 * "(informational)" — it's the same team-style ripple one level up
 * (locked-spec.md's "team/division aggregate totals"), but it never gates
 * sign-off, so it's deliberately not folded into the sign-off banner below
 * the way team/cohort/org are.
 */

export function CrossCheckPanel({ result }: { result: OverrideCrossCheckResult }) {
  if (!result.hasOrgData) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Real-time cross-check</h2>
        <p data-testid="crosscheck-no-data" className="mt-2 text-sm text-slate-500">
          Organisational data not yet available — cross-check skipped.
        </p>
        {result.requiresSignOff && (
          <p data-testid="crosscheck-signoff-banner" className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            This change still requires sign-off from this person's team leadership group: {result.signOffReasons.join(' ')}{' '}
            Once applied, it&apos;ll appear in the{' '}
            <Link to="/system1/exceptions" className="font-medium underline">
              Sign-off Queue →
            </Link>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Real-time cross-check</h2>
      <div data-testid="crosscheck-panel" className="mt-2">
        {result.team && (
          <CheckStatusRow testId="crosscheck-team" label="Team total" status={result.team.status} detail={result.team.detail} />
        )}
        {result.division && (
          <CheckStatusRow
            testId="crosscheck-division"
            label="Division total (informational)"
            status={result.division.status}
            detail={result.division.detail}
          />
        )}
        {result.cohort && (
          <CheckStatusRow testId="crosscheck-cohort" label="Level-cohort norms" status={result.cohort.status} detail={result.cohort.detail} />
        )}
        {result.org && (
          <CheckStatusRow testId="crosscheck-org" label="Org goal integrity" status={result.org.status} detail={result.org.detail} />
        )}
      </div>
      {result.requiresSignOff && (
        <div data-testid="crosscheck-signoff-banner" className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-medium">
            This change requires sign-off from {result.team?.division ?? 'this'} / {result.team?.team ?? 'team'}&apos;s leadership
            group.
          </p>
          <ul className="mt-1 list-disc pl-4">
            {result.signOffReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="mt-2">
            Once applied, it&apos;ll appear in the{' '}
            <Link to="/system1/exceptions" className="font-medium underline">
              Sign-off Queue →
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
