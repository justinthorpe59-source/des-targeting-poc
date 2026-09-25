import { Link } from 'react-router-dom'
import type { OverrideCrossCheckResult } from '../engine/overrideCrossCheck'
import { Accordion, type AccordionItem } from '../../components/searchlight/Accordion'

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
 *
 * Visual rebuild: rows now render through the shared Accordion (spec's
 * "Use 2" for that component) — pass/fail per check visible collapsed, that
 * check's specific numeric effect on expand. The pass/fail mark that used to
 * be CheckStatusRow's badge moves into the collapsed label, so nothing is
 * hidden behind an expand that wasn't hidden before.
 */

function CheckMark({ status }: { status: 'pass' | 'fail' }) {
  return (
    <span
      data-status={status}
      aria-label={status === 'pass' ? 'Passed' : 'Failed'}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full font-pa-body text-[11px] font-bold"
      style={
        status === 'pass'
          ? { background: 'var(--color-pa-lime-02)', color: 'var(--color-pa-lime-04)' }
          : { background: 'var(--color-pa-rose-01)', color: 'var(--color-pa-rose-04)' }
      }
    >
      {status === 'pass' ? '✓' : '✕'}
    </span>
  )
}

function checkItems(result: OverrideCrossCheckResult): AccordionItem[] {
  const defs: Array<{ key: string; label: string; check: { status: 'pass' | 'fail'; detail: string } | null | undefined }> = [
    { key: 'team', label: 'Team total', check: result.team },
    { key: 'division', label: 'Division total (informational)', check: result.division },
    { key: 'cohort', label: 'Level-cohort norms', check: result.cohort },
    { key: 'org', label: 'Org goal integrity', check: result.org },
  ]
  return defs
    .filter((d) => d.check)
    .map((d) => ({
      id: d.key,
      testId: `crosscheck-${d.key}`,
      dataAttrs: { 'data-check-status': d.check!.status },
      label: (
        <>
          <CheckMark status={d.check!.status} />
          {d.label}
        </>
      ),
      content: (
        <p data-testid={`crosscheck-${d.key}-detail`} className="font-pa-body text-xs text-pa-grey-03">
          {d.check!.detail}
        </p>
      ),
    }))
}

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
      <div className="mt-2">
        <Accordion testId="crosscheck-panel" items={checkItems(result)} />
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
