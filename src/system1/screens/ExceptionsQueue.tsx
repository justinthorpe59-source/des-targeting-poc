import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import type { Person } from '../data/types'
import { useSystem1Store, type SignOffContext, type TargetRecord } from '../../store/system1Store'
import { detectExceptions, type ExceptionFlag, type ExceptionType } from '../engine/exceptions'
import { Accordion, type AccordionItem } from '../../components/searchlight/Accordion'

/**
 * M9's exceptions queue, plus the Sign-off Queue folded in by the 5-screen
 * consolidation. This is System 1's single reviewer inbox.
 *
 * Four row types share one accordion (the global system's "Use 1"):
 *   missing-data / extreme-value / large-adjustment — live threshold
 *     violations, recomputed every render by detectExceptions().
 *   pending-signoff — a frozen decision waiting on a person, in two
 *     variants: one record, or a whole mass-adjustment batch.
 *
 * Batch rows deliberately do NOT carry a person: a mass adjustment applies to
 * many people at once, so forcing a name into that slot would misrepresent
 * what is being signed off. They lead with the team and headcount instead.
 *
 * Nothing here recomputes a cross-check. A sign-off row renders the
 * SignOffContext that Manager Override or Mass Adjustment already froze onto
 * the record.
 */

type RowType = ExceptionType | 'pending-signoff'

const TYPE_LABELS: Record<RowType, string> = {
  'missing-data': 'Missing data',
  'extreme-value': 'Extreme value',
  'large-adjustment': 'Large adjustment',
  'pending-signoff': 'Pending sign-off',
}

/**
 * Severity onto the PA palette. Missing data is the hard failure (a record
 * that cannot be trusted at all), extreme value the warning, large adjustment
 * informational, and pending sign-off an action waiting on a human rather
 * than a fault — so it takes Apricot, the same token the workflow state uses.
 */
const TYPE_TONE: Record<RowType, { fill: string; text: string; severity: string }> = {
  'missing-data': { fill: 'var(--color-pa-rose-01)', text: 'var(--color-pa-rose-04)', severity: 'High' },
  'extreme-value': { fill: 'var(--color-pa-apricot-02)', text: 'var(--color-pa-grey-04)', severity: 'Medium' },
  'large-adjustment': { fill: 'var(--color-pa-aqua-02)', text: 'var(--color-pa-aqua-05)', severity: 'Review' },
  'pending-signoff': {
    fill: 'var(--color-pa-state-pending-signoff)',
    text: 'var(--color-pa-dark-blue)',
    severity: 'Awaiting sign-off',
  },
}

/** People listed in a batch before the rest go behind a reveal. */
const BATCH_PREVIEW = 5

const FILTER_OPTIONS: Array<RowType | 'All'> = [
  'All',
  'missing-data',
  'extreme-value',
  'large-adjustment',
  'pending-signoff',
]

function FlagChip({ type }: { type: RowType }) {
  const tone = TYPE_TONE[type]
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-pa-body text-[11px] font-semibold"
      style={{ background: tone.fill, color: tone.text }}
    >
      {TYPE_LABELS[type]}
    </span>
  )
}

function Severity({ type }: { type: RowType }) {
  return (
    <span className="shrink-0 font-pa-body text-xs font-medium text-pa-grey-03">{TYPE_TONE[type].severity}</span>
  )
}

/** A failed/passed check line inside an expanded row. */
function CheckLine({ label, status, detail }: { label: string; status: 'pass' | 'fail'; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-pa-body text-[11px] font-bold"
        style={
          status === 'pass'
            ? { background: 'var(--color-pa-lime-02)', color: 'var(--color-pa-lime-04)' }
            : { background: 'var(--color-pa-rose-01)', color: 'var(--color-pa-rose-04)' }
        }
      >
        {status === 'pass' ? '✓' : '✕'}
      </span>
      <div>
        <div className="font-pa-body text-sm font-medium text-pa-grey-04">{label}</div>
        <div className="font-pa-body text-xs text-pa-grey-03">{detail}</div>
      </div>
    </div>
  )
}

function ContextChecks({ context }: { context: SignOffContext }) {
  const rows = [
    { key: 'team', label: 'Team total', check: context.team },
    { key: 'cohort', label: 'Level-cohort norms', check: context.cohort },
    { key: 'org', label: 'Org goal integrity', check: context.org },
  ].filter((r) => r.check)

  return (
    <div>
      {rows.length > 0 ? (
        rows.map((r) => (
          <CheckLine key={r.key} label={r.label} status={r.check!.status} detail={r.check!.detail} />
        ))
      ) : (
        <p className="font-pa-body text-sm text-pa-grey-03">
          Organisational data wasn&apos;t available when this was flagged — only the drastic-percentage-change
          trigger applied.
        </p>
      )}
      {context.reasons.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 font-pa-body text-xs text-pa-grey-04">
          {context.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Approve/reject controls, shared by both sign-off row variants. */
function SignOffActions({
  testIdPrefix,
  onApprove,
  onReject,
}: {
  testIdPrefix: string
  onApprove: (note: string) => void
  onReject: (reason: string) => void
}) {
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  return (
    <div className="mt-5 border-t border-pa-grey-01 pt-5">
      <label className="block font-pa-body text-xs font-medium text-pa-grey-03">
        {rejecting ? 'Reason for rejecting (required)' : 'Sign-off note (required)'}
        <input
          type="text"
          data-testid={`${testIdPrefix}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={rejecting ? 'Why is this being rejected?' : 'Why is this being signed off?'}
          className="mt-1.5 w-full max-w-xl rounded-pa-chip border border-pa-grey-02 bg-pa-white px-3 py-2 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-03"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!rejecting ? (
          <>
            <button
              type="button"
              data-testid={`${testIdPrefix}-approve`}
              disabled={note.trim().length === 0}
              onClick={() => onApprove(note.trim())}
              className="rounded-full bg-pa-aqua-05 px-4 py-2 font-pa-body text-xs font-semibold text-pa-white transition-colors hover:bg-pa-aqua-04 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Approve
            </button>
            <button
              type="button"
              data-testid={`${testIdPrefix}-show-reject`}
              onClick={() => setRejecting(true)}
              className="rounded-full bg-pa-grey-01 px-4 py-2 font-pa-body text-xs font-semibold text-pa-grey-04 transition-colors hover:bg-pa-grey-02/60"
            >
              Reject
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              data-testid={`${testIdPrefix}-reject`}
              disabled={note.trim().length === 0}
              onClick={() => onReject(note.trim())}
              className="rounded-full px-4 py-2 font-pa-body text-xs font-semibold text-pa-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--color-pa-rose-04)' }}
            >
              Confirm reject
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded-full bg-pa-grey-01 px-4 py-2 font-pa-body text-xs font-semibold text-pa-grey-04 transition-colors hover:bg-pa-grey-02/60"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}

interface PendingRow {
  person: Person
  target: TargetRecord
  context: SignOffContext
}

export function ExceptionsQueue() {
  const navigate = useNavigate()
  const targets = useSystem1Store((state) => state.targets)
  const approveSignOff = useSystem1Store((state) => state.approveSignOff)
  const rejectSignOff = useSystem1Store((state) => state.rejectSignOff)
  const approveSignOffBatch = useSystem1Store((state) => state.approveSignOffBatch)
  const rejectSignOffBatch = useSystem1Store((state) => state.rejectSignOffBatch)

  const [typeFilter, setTypeFilter] = useState<RowType | 'All'>('All')
  const [showAllInBatch, setShowAllInBatch] = useState(false)

  const flagsByPerson = useMemo(() => detectExceptions({ people: SEED_PEOPLE, targets }), [targets])

  /** Records sitting at Pending Sign-off, split into batches and singles. */
  const { batches, individuals } = useMemo(() => {
    const batchMap = new Map<string, PendingRow[]>()
    const singles: PendingRow[] = []
    for (const person of SEED_PEOPLE) {
      const target = targets[person.id]
      if (target?.status !== 'Pending Sign-off' || !target.signOffContext) continue
      const row: PendingRow = { person, target, context: target.signOffContext }
      const batchId = target.signOffContext.batchId
      if (batchId) {
        batchMap.set(batchId, [...(batchMap.get(batchId) ?? []), row])
      } else {
        singles.push(row)
      }
    }
    return { batches: batchMap, individuals: singles }
  }, [targets])

  const items = useMemo<AccordionItem[]>(() => {
    const out: AccordionItem[] = []
    const wants = (t: RowType) => typeFilter === 'All' || typeFilter === t

    // ---- batch sign-off rows: no single person, so they lead with the team
    if (wants('pending-signoff')) {
      for (const [batchId, rows] of batches) {
        const first = rows[0]
        const { context } = first
        /* Scope is derived from who is actually IN the batch, not from the
           first row. A mass adjustment filtered to a division spans both its
           teams, and naming the first person's team would claim the change
           hit one team when it hit two. */
        const divisions = [...new Set(rows.map((r) => r.person.division))]
        const teams = [...new Set(rows.map((r) => `${r.person.division} / ${r.person.team}`))]
        const scope =
          teams.length === 1 ? teams[0] : divisions.length === 1 ? divisions[0] : 'DES-wide'
        out.push({
          id: `batch-${batchId}`,
          testId: 'exceptions-row',
          dataAttrs: { 'data-row-type': 'pending-signoff-batch', 'data-batch-id': batchId },
          label: (
            <>
              <span>
                {scope} mass adjustment — {rows.length} {rows.length === 1 ? 'person' : 'people'} affected
              </span>
              <FlagChip type="pending-signoff" />
              <Severity type="pending-signoff" />
            </>
          ),
          content: (
            <div>
              {context.aggregateGroups && context.aggregateGroups.length > 0 && (
                <div className="mb-4">
                  <div className="mb-1 font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
                    Aggregate effect — the whole batch applied together
                  </div>
                  {context.aggregateGroups.map((group) => (
                    <CheckLine key={group.key} label={group.label} status={group.status} detail={group.detail} />
                  ))}
                </div>
              )}

              <div className="mb-1 font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
                Individual breakdown · {context.batchIndividualPassCount ?? '—'} of{' '}
                {context.batchSize ?? rows.length} passed their own checks
              </div>
              {/* One compact line per person. The full reason text is
                  deliberately not repeated here: every entry in a batch
                  trips the same checks, so printing all of them produced a
                  wall of near-identical paragraphs that buried the figures.
                  The aggregate block above already states what failed; this
                  list answers "who, and by how much". */}
              <ul className="font-pa-body text-xs">
                {rows.slice(0, showAllInBatch ? rows.length : BATCH_PREVIEW).map((r) => {
                  const failed = r.context.reasons.length
                  return (
                    <li
                      key={r.person.id}
                      className="flex flex-wrap items-baseline gap-x-2 border-b border-pa-grey-01 py-2 last:border-0"
                    >
                      <span className="font-medium text-pa-grey-04">{r.person.name}</span>
                      <span className="font-pa-mono text-pa-grey-03">
                        £{r.target.modelled}k → £{r.target.override?.finalValue}k
                      </span>
                      <span
                        className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={
                          failed
                            ? { background: 'var(--color-pa-rose-01)', color: 'var(--color-pa-rose-04)' }
                            : { background: 'var(--color-pa-lime-02)', color: 'var(--color-pa-lime-04)' }
                        }
                      >
                        {failed ? `${failed} check${failed === 1 ? '' : 's'} failed` : 'passed'}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {rows.length > BATCH_PREVIEW && (
                <button
                  type="button"
                  data-testid="batch-show-all"
                  onClick={() => setShowAllInBatch((v) => !v)}
                  className="mt-3 rounded-full bg-pa-grey-01 px-3.5 py-1.5 font-pa-body text-xs font-semibold text-pa-grey-04 transition-colors hover:bg-pa-grey-02/60"
                >
                  {showAllInBatch ? 'Show fewer' : `Show all ${rows.length}`}
                </button>
              )}

              <SignOffActions
                testIdPrefix="batch-signoff"
                onApprove={(note) =>
                  approveSignOffBatch(rows.map((r) => r.person.id), note, `${scope} leadership`)
                }
                onReject={(reason) =>
                  rejectSignOffBatch(rows.map((r) => r.person.id), reason, `${scope} leadership`)
                }
              />
            </div>
          ),
        })
      }

      // ---- single-record sign-off rows
      for (const row of individuals) {
        const scope = `${row.person.division} / ${row.person.team}`
        out.push({
          id: `signoff-${row.person.id}`,
          testId: 'exceptions-row',
          dataAttrs: { 'data-row-type': 'pending-signoff', 'data-person-id': row.person.id },
          label: (
            <>
              <span>{row.person.name}</span>
              <FlagChip type="pending-signoff" />
              <Severity type="pending-signoff" />
            </>
          ),
          meta: `${row.person.id} · ${scope} · £${row.target.modelled}k → £${row.target.override?.finalValue}k`,
          content: (
            <div>
              <ContextChecks context={row.context} />
              <SignOffActions
                testIdPrefix="signoff"
                onApprove={(note) => approveSignOff(row.person.id, note, `${scope} leadership`)}
                onReject={(reason) => rejectSignOff(row.person.id, reason, `${scope} leadership`)}
              />
            </div>
          ),
        })
      }
    }

    // ---- threshold exception rows
    const exceptionEntries = [...flagsByPerson.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    for (const [personId, allFlags] of exceptionEntries) {
      const flags: ExceptionFlag[] =
        typeFilter === 'All' || typeFilter === 'pending-signoff'
          ? allFlags
          : allFlags.filter((f) => f.type === typeFilter)
      if (flags.length === 0 || typeFilter === 'pending-signoff') continue
      const person = SEED_PEOPLE.find((p) => p.id === personId)!
      const worst = flags[0].type
      out.push({
        id: `exception-${personId}`,
        testId: 'exceptions-row',
        dataAttrs: { 'data-row-type': worst, 'data-person-id': personId },
        label: (
          <>
            <span>{person.name}</span>
            {flags.map((flag, i) => (
              <FlagChip key={i} type={flag.type} />
            ))}
            <Severity type={worst} />
          </>
        ),
        meta: `${person.id} · ${person.division} / ${person.team}`,
        content: (
          <div>
            <div className="mb-1 font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
              What failed
            </div>
            <ul className="font-pa-body text-sm text-pa-grey-04">
              {flags.map((flag, i) => (
                <li key={i} className="border-b border-pa-grey-01 py-2 last:border-0">
                  <span className="font-medium">{TYPE_LABELS[flag.type]}</span> — {flag.detail}
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-pa-grey-01 pt-5">
              <button
                type="button"
                data-testid="exceptions-resolve"
                onClick={() => navigate(`/system1/override/${personId}`)}
                className="rounded-full bg-pa-aqua-05 px-4 py-2 font-pa-body text-xs font-semibold text-pa-white transition-colors hover:bg-pa-aqua-04"
              >
                Resolve in Manager Override →
              </button>
            </div>
          </div>
        ),
      })
    }

    return out
  }, [
    showAllInBatch,
    batches,
    individuals,
    flagsByPerson,
    typeFilter,
    navigate,
    approveSignOff,
    rejectSignOff,
    approveSignOffBatch,
    rejectSignOffBatch,
  ])

  return (
    <section className="space-y-8">
      {/* Eyebrow + large two-line centred heading, per the reference. */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-pa-body text-xs font-bold uppercase tracking-[0.14em] text-pa-grey-03">
          Design, Engineering &amp; Science
        </p>
        <h1 className="mt-4 font-pa-display text-5xl font-semibold leading-[1.1] text-pa-grey-04">
          Exceptions &amp;
          <br />
          sign-off queue
        </h1>
      </div>

      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const active = typeFilter === opt
          return (
            <button
              key={opt}
              type="button"
              data-testid="exceptions-type-filter"
              data-filter={opt}
              data-active={active ? 'true' : 'false'}
              onClick={() => setTypeFilter(opt)}
              className={`rounded-full px-3.5 py-1.5 font-pa-body text-xs font-semibold transition-colors ${
                active
                  ? 'bg-pa-aqua-05 text-pa-white'
                  : 'bg-pa-grey-01 text-pa-grey-04 hover:bg-pa-grey-02/60'
              }`}
            >
              {opt === 'All' ? 'All types' : TYPE_LABELS[opt]}
            </button>
          )
        })}
      </div>

      <div className="mx-auto max-w-4xl">
        <p data-testid="exceptions-count" className="mb-4 text-center font-pa-body text-sm text-pa-grey-03">
          {items.length} item{items.length === 1 ? '' : 's'} flagged
        </p>

        {items.length === 0 ? (
          <p
            data-testid="exceptions-empty"
            className="rounded-pa-card bg-pa-white p-8 text-center font-pa-body text-sm text-pa-grey-03"
          >
            Nothing flagged{typeFilter !== 'All' ? ` of type “${TYPE_LABELS[typeFilter]}”` : ''} right now.
          </p>
        ) : (
          <Accordion testId="exceptions-rows" items={items} />
        )}
      </div>
    </section>
  )
}
