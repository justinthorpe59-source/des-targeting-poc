import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { DIVISIONS, TEAMS_BY_DIVISION, type Person } from '../data/types'
import { useSystem1Store, type SignOffContext, type TargetRecord } from '../../store/system1Store'
import { CheckStatusRow } from '../components/CheckStatusRow'

const ALL = 'All teams' as const

const TEAM_OPTIONS = DIVISIONS.flatMap((division) =>
  TEAMS_BY_DIVISION[division].map((team) => ({ division, team, key: `${division}::${team}` })),
)

interface PendingRow {
  person: Person
  target: TargetRecord
  context: SignOffContext
}

/**
 * Batch 3d: the sign-off approval screen for changes 3b/3c routed to
 * 'Pending Sign-off'. Per locked-spec.md, this sits alongside the
 * Exceptions Queue's known access-control gap — the team selector below
 * scopes what's shown, exactly like the rest of this POC's "no real auth"
 * approach (Employee View's person picker, Manager Override's person
 * picker), not an enforced permission boundary.
 *
 * Every check breakdown here is SignOffContext — the frozen cross-check
 * result 3b/3c already computed and Manager Override/Mass Adjustment
 * already stored on the record — rendered with the same CheckStatusRow
 * both of those screens' panels use. Nothing here recomputes a check.
 */
export function SignOffQueue() {
  const targets = useSystem1Store((state) => state.targets)
  const auditLog = useSystem1Store((state) => state.auditLog)
  const approveSignOff = useSystem1Store((state) => state.approveSignOff)
  const approveSignOffBatch = useSystem1Store((state) => state.approveSignOffBatch)
  const rejectSignOff = useSystem1Store((state) => state.rejectSignOff)
  const rejectSignOffBatch = useSystem1Store((state) => state.rejectSignOffBatch)

  const [teamScope, setTeamScope] = useState<string>(ALL)

  const pending: PendingRow[] = useMemo(() => {
    const rows: PendingRow[] = []
    for (const person of SEED_PEOPLE) {
      const target = targets[person.id]
      if (target?.status === 'Pending Sign-off' && target.signOffContext) {
        rows.push({ person, target, context: target.signOffContext })
      }
    }
    return rows
  }, [targets])

  const scoped = useMemo(() => {
    if (teamScope === ALL) return pending
    return pending.filter((row) => `${row.person.division}::${row.person.team}` === teamScope)
  }, [pending, teamScope])

  // Group by signOffContext.batchId (mass-adjustment entries sharing an
  // Apply click) — anything without a batchId is its own single-person entry.
  const { batches, individuals } = useMemo(() => {
    const batchMap = new Map<string, PendingRow[]>()
    const individualRows: PendingRow[] = []
    for (const row of scoped) {
      const batchId = row.context.batchId
      if (batchId) {
        const arr = batchMap.get(batchId) ?? []
        arr.push(row)
        batchMap.set(batchId, arr)
      } else {
        individualRows.push(row)
      }
    }
    return { batches: batchMap, individuals: individualRows }
  }, [scoped])

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Sign-off queue</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Changes the real-time cross-check flagged — a failed check, or a drastic percentage change — wait here
          for a team's leadership group to approve or reject.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Reviewing as (demo only — this app has no real sign-in)
        <select
          data-testid="signoff-team-scope"
          className="w-64 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
          value={teamScope}
          onChange={(e) => setTeamScope(e.target.value)}
        >
          <option value={ALL}>{ALL} (all leadership groups)</option>
          {TEAM_OPTIONS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.division} / {t.team} leadership
            </option>
          ))}
        </select>
      </label>

      <div data-testid="signoff-count" className="text-sm text-slate-600">
        {scoped.length} record{scoped.length === 1 ? '' : 's'} pending sign-off
        {teamScope !== ALL ? ` for ${teamScope.replace('::', ' / ')}` : ''}.
      </div>

      {scoped.length === 0 ? (
        <p data-testid="signoff-empty" className="text-sm text-slate-500">
          Nothing pending sign-off{teamScope !== ALL ? ' for this team' : ''} right now.
        </p>
      ) : (
        <div data-testid="signoff-entries" className="space-y-4">
          {[...batches.entries()].map(([batchId, rows]) => (
            <BatchEntry
              key={batchId}
              rows={rows}
              onApprove={(note) =>
                approveSignOffBatch(
                  rows.map((r) => r.person.id),
                  note,
                  `${rows[0].person.division} / ${rows[0].person.team} leadership`,
                )
              }
              onReject={(reason) =>
                rejectSignOffBatch(
                  rows.map((r) => r.person.id),
                  reason,
                  `${rows[0].person.division} / ${rows[0].person.team} leadership`,
                )
              }
            />
          ))}
          {individuals.map((row) => (
            <IndividualEntry
              key={row.person.id}
              row={row}
              auditLog={auditLog}
              onApprove={(note) => approveSignOff(row.person.id, note, `${row.person.division} / ${row.person.team} leadership`)}
              onReject={(reason) => rejectSignOff(row.person.id, reason, `${row.person.division} / ${row.person.team} leadership`)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ContextChecks({ context }: { context: SignOffContext }) {
  return (
    <div className="mt-3">
      {context.team && <CheckStatusRow testId="signoff-check-team" label="Team total" status={context.team.status} detail={context.team.detail} />}
      {context.cohort && (
        <CheckStatusRow testId="signoff-check-cohort" label="Level-cohort norms" status={context.cohort.status} detail={context.cohort.detail} />
      )}
      {context.org && <CheckStatusRow testId="signoff-check-org" label="Org goal integrity" status={context.org.status} detail={context.org.detail} />}
      {!context.team && !context.cohort && !context.org && (
        <p className="py-2 text-xs text-slate-500">
          Organisational data wasn't available when this was flagged — only the drastic-percentage-change trigger applied.
        </p>
      )}
      {context.reasons.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-amber-800">
          {context.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ApproveRejectForm({ onApprove, onReject }: { onApprove: (note: string) => void; onReject: (reason: string) => void }) {
  const [note, setNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {!showReject ? (
        <div className="flex items-end gap-2">
          <label className="flex-1 text-xs font-medium text-slate-500">
            Sign-off note (required)
            <input
              data-testid="signoff-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Why is this being signed off?"
            />
          </label>
          <button
            type="button"
            data-testid="signoff-approve-button"
            disabled={note.trim().length === 0}
            onClick={() => onApprove(note.trim())}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Approve
          </button>
          <button
            type="button"
            data-testid="signoff-show-reject-button"
            onClick={() => setShowReject(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <label className="flex-1 text-xs font-medium text-slate-500">
            Reason for rejecting (required)
            <input
              data-testid="signoff-reject-reason-input"
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Why is this being rejected?"
            />
          </label>
          <button
            type="button"
            data-testid="signoff-reject-button"
            disabled={rejectReason.trim().length === 0}
            onClick={() => onReject(rejectReason.trim())}
            className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm reject
          </button>
          <button
            type="button"
            onClick={() => setShowReject(false)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function IndividualEntry({
  row,
  auditLog,
  onApprove,
  onReject,
}: {
  row: PendingRow
  auditLog: { personId: string; actor: string; timestamp: string }[]
  onApprove: (note: string) => void
  onReject: (reason: string) => void
}) {
  const { person, target, context } = row
  const proposedBy = [...auditLog].reverse().find((e) => e.personId === person.id)

  return (
    <div data-testid="signoff-entry" data-person-id={person.id} className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          <Link to={`/system1/person/${person.id}`} className="hover:underline">
            {person.name}
          </Link>{' '}
          <span className="font-normal text-slate-500">
            ({person.id} · {person.division} / {person.team})
          </span>
        </h2>
        {proposedBy && <span className="text-xs text-slate-500">Proposed by {proposedBy.actor}</span>}
      </div>

      <div className="mt-1 text-sm text-slate-600">
        Original £{target.modelled}k → proposed{' '}
        <span className="font-medium tabular-nums text-slate-900">£{target.override?.finalValue}k</span>{' '}
        <span className="text-xs text-slate-500">
          ({target.override?.type === 'percent' ? `${target.override.value > 0 ? '+' : ''}${target.override.value}%` : 'direct value'})
        </span>
      </div>
      {target.override?.reason && <div className="mt-1 text-xs text-slate-500">Reason given: {target.override.reason}</div>}

      <ContextChecks context={context} />
      <ApproveRejectForm onApprove={onApprove} onReject={onReject} />
    </div>
  )
}

function BatchEntry({
  rows,
  onApprove,
  onReject,
}: {
  rows: PendingRow[]
  onApprove: (note: string) => void
  onReject: (reason: string) => void
}) {
  const first = rows[0]
  const context = first.context
  const batchSize = context.batchSize ?? rows.length

  return (
    <div data-testid="signoff-batch-entry" data-batch-id={context.batchId} className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Mass adjustment — {rows.length} affected</h2>
        <span className="text-xs text-slate-500">
          {context.batchIndividualPassCount ?? '—'} of {batchSize} passed individually
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {rows.map((r) => `${r.person.name} (${r.person.id})`).join(', ')}
      </p>

      {context.aggregateGroups && context.aggregateGroups.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Aggregate effect — the whole batch applied together
          </div>
          {context.aggregateGroups.map((group) => (
            <CheckStatusRow key={group.key} testId={`signoff-batch-group-${group.key}`} label={group.label} status={group.status} detail={group.detail} />
          ))}
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-2">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Individual breakdown</div>
        {rows.map((r) => (
          <div key={r.person.id} className="border-b border-slate-100 py-2 text-xs last:border-0">
            <span className="font-medium text-slate-700">
              {r.person.name} ({r.person.id})
            </span>{' '}
            <span className="text-slate-500">
              — £{r.target.modelled}k → £{r.target.override?.finalValue}k
              {r.context.reasons.length > 0 ? `: ${r.context.reasons.join(' ')}` : ' — passed its own checks'}
            </span>
          </div>
        ))}
      </div>

      <ApproveRejectForm onApprove={onApprove} onReject={onReject} />
    </div>
  )
}
