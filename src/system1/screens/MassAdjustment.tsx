import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import type { Person } from '../data/types'
import { computeMassAdjustmentCrossCheck } from '../engine/massAdjustmentCrossCheck'
import { buildMassSignOffContext } from '../engine/buildSignOffContext'
import { MassAdjustmentCrossCheckPanel } from '../components/MassAdjustmentCrossCheckPanel'
import { useSystem1Store } from '../../store/system1Store'
import { useSystem2LiveSnapshot } from '../../system2/bridge/useSystem2LiveState'
import { StatusPill } from '../../components/searchlight/StatusPill'

/** People listed before the rest go behind a reveal. */
const PREVIEW_ROWS = 6

/**
 * M10: mass adjustment.
 *
 * Population comes from Overview & Population's roster multi-select, held in
 * system1Store — this screen has no picker of its own, per CLAUDE.md. It
 * previously carried duplicate division/team/location selects, which meant
 * the checkbox selection a manager had just made was ignored.
 *
 * People who already have an individual override are excluded by design: a
 * broad action shouldn't silently overwrite a manager's earlier, specific
 * decision.
 *
 * Applying reuses applyOverride() per person via the store's
 * applyMassAdjustment loop — no second implementation of the maths.
 */
export function MassAdjustment() {
  const [percent, setPercent] = useState(0)
  const [reason, setReason] = useState('')
  const [showAllRows, setShowAllRows] = useState(false)
  const [lastApplied, setLastApplied] = useState<{ count: number; percent: number; signOffCount: number } | null>(
    null,
  )

  const targets = useSystem1Store((state) => state.targets)
  const selectedPersonIds = useSystem1Store((state) => state.selectedPersonIds)
  const clearSelection = useSystem1Store((state) => state.clearSelection)
  const applyMassAdjustment = useSystem1Store((state) => state.applyMassAdjustment)
  const system2Snapshot = useSystem2LiveSnapshot()

  const selected = useMemo<Person[]>(
    () => SEED_PEOPLE.filter((p) => selectedPersonIds.includes(p.id)),
    [selectedPersonIds],
  )

  const { eligible, excluded } = useMemo(() => {
    const eligible: Person[] = []
    const excluded: Person[] = []
    for (const person of selected) {
      if (targets[person.id]?.override) excluded.push(person)
      else eligible.push(person)
    }
    return { eligible, excluded }
  }, [selected, targets])

  /**
   * Preview rows are the TARGET before and after — the same quantity
   * applyOverride actually writes (modelled x (1 + percent/100)).
   *
   * This previously previewed combinedRevenueFor(person), a different
   * quantity entirely, so every row showed a number that was not what got
   * applied: a +8% run previewed a person at £121k and stored £84k. The
   * preview and the apply now read from one source.
   */
  const preview = useMemo(
    () =>
      eligible.map((person) => {
        const target = targets[person.id]
        const before = target?.modelled ?? 0
        const after = Math.round(before * (1 + percent / 100))
        return { person, before, after }
      }),
    [eligible, percent, targets],
  )

  const totalBefore = preview.reduce((sum, row) => sum + row.before, 0)
  const totalAfter = preview.reduce((sum, row) => sum + row.after, 0)
  const netChange = totalAfter - totalBefore
  const netChangePct = totalBefore === 0 ? 0 : Math.round((netChange / totalBefore) * 100)

  const crossCheck = useMemo(() => {
    if (eligible.length === 0) return null
    return computeMassAdjustmentCrossCheck({
      people: eligible,
      percent,
      targets,
      snapshot: system2Snapshot,
      allPeople: SEED_PEOPLE,
    })
  }, [eligible, percent, targets, system2Snapshot])

  const signOffPersonIds = useMemo(() => {
    if (!crossCheck) return []
    if (crossCheck.routing === 'whole-batch') return eligible.map((p) => p.id)
    if (crossCheck.routing === 'outliers-only') return crossCheck.outliers.map((o) => o.person.id)
    return []
  }, [crossCheck, eligible])

  const canApply = reason.trim().length > 0 && eligible.length > 0 && percent !== 0

  function handleApply() {
    if (!canApply) return
    const signOffContextByPersonId =
      crossCheck && signOffPersonIds.length > 0
        ? buildMassSignOffContext(crossCheck, crypto.randomUUID())
        : undefined
    applyMassAdjustment(
      eligible.map((p) => p.id),
      { percent, reason: reason.trim(), signOffPersonIds, signOffContextByPersonId },
    )
    setLastApplied({ count: eligible.length, percent, signOffCount: signOffPersonIds.length })
    setReason('')
  }

  const visibleRows = showAllRows ? preview : preview.slice(0, PREVIEW_ROWS)

  return (
    <section className="space-y-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-pa-body text-xs font-bold uppercase tracking-[0.14em] text-pa-grey-03">
          Design, Engineering &amp; Science
        </p>
        <h1 className="mt-4 font-pa-display text-5xl font-semibold leading-[1.1] text-pa-grey-04">
          Mass adjustment
        </h1>
        <p className="mx-auto mt-4 max-w-md font-pa-body text-sm text-pa-grey-03">
          A percentage change across the people you selected. Nothing applies until you confirm, and a reason is
          always required.
        </p>
      </div>

      <div className="mx-auto max-w-4xl space-y-6">
        {lastApplied && (
          <div
            data-testid="mass-adjustment-success"
            className="rounded-pa-card px-6 py-4 font-pa-body text-sm text-pa-grey-04"
            style={{ background: 'var(--color-pa-lime-01)' }}
          >
            Applied {lastApplied.percent > 0 ? '+' : ''}
            {lastApplied.percent}% to {lastApplied.count} record{lastApplied.count === 1 ? '' : 's'}.
            {lastApplied.signOffCount > 0 && (
              <>
                {' '}
                {lastApplied.signOffCount} of those route to Pending Sign-off —{' '}
                <Link to="/system1/exceptions" className="font-semibold text-pa-aqua-05 underline">
                  view the queue →
                </Link>
              </>
            )}
          </div>
        )}

        {/* ---- Population: from the roster selection, never a picker here ---- */}
        {selected.length === 0 ? (
          <div
            data-testid="mass-no-selection"
            className="rounded-pa-card bg-pa-white px-8 py-10 text-center"
          >
            <p className="font-pa-body text-base font-semibold text-pa-grey-04">Nobody selected yet.</p>
            <p className="mx-auto mt-2 max-w-md font-pa-body text-sm text-pa-grey-03">
              This screen adjusts the people you tick on Overview &amp; Population — it deliberately has no
              picker of its own, so the population you act on is the one you just looked at.
            </p>
            <Link
              to="/system1/overview"
              className="mt-5 inline-block rounded-full bg-pa-aqua-05 px-5 py-2.5 font-pa-body text-sm font-semibold text-pa-white transition-colors hover:bg-pa-aqua-04"
            >
              Choose people →
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-pa-card bg-pa-white p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-pa-display text-sm font-semibold text-pa-grey-04">Selected population</h2>
                <button
                  type="button"
                  data-testid="mass-clear-selection"
                  onClick={clearSelection}
                  className="rounded-full bg-pa-grey-01 px-3.5 py-1.5 font-pa-body text-xs font-semibold text-pa-grey-04 transition-colors hover:bg-pa-grey-02/60"
                >
                  Clear selection
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-8">
                <div>
                  <div data-testid="mass-eligible-count" className="font-pa-mono text-3xl font-bold text-pa-grey-04">
                    {eligible.length}
                  </div>
                  <div className="font-pa-body text-xs text-pa-grey-03">will be adjusted</div>
                </div>
                {excluded.length > 0 && (
                  <div>
                    <div className="font-pa-mono text-3xl font-bold text-pa-grey-03">{excluded.length}</div>
                    <div data-testid="mass-excluded-note" className="font-pa-body text-xs text-pa-grey-03">
                      skipped — already individually overridden
                    </div>
                  </div>
                )}
              </div>

              {excluded.length > 0 && (
                <p className="mt-3 font-pa-body text-xs text-pa-grey-03">
                  A broad change never silently overwrites a manager&apos;s earlier, specific decision. Revert
                  those individually if you want them included.
                </p>
              )}
            </div>

            {/* ---- The change ---- */}
            <div className="rounded-pa-card bg-pa-white p-8">
              <h2 className="font-pa-display text-sm font-semibold text-pa-grey-04">The change</h2>

              <label className="mt-4 block font-pa-body text-xs font-medium text-pa-grey-03">
                Percentage change
                <input
                  data-testid="mass-percent-input"
                  type="number"
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value))}
                  className="mt-1.5 w-40 rounded-pa-chip border border-pa-grey-02 bg-pa-white px-3 py-2 font-pa-mono text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-03"
                />
              </label>

              <div className="mt-5 flex flex-wrap gap-8 border-t border-pa-grey-01 pt-5">
                <div>
                  <div className="font-pa-body text-[11px] uppercase tracking-wide text-pa-grey-03">
                    Total target before
                  </div>
                  <div data-testid="mass-total-before" className="font-pa-mono text-xl font-bold text-pa-grey-04">
                    £{totalBefore.toLocaleString()}k
                  </div>
                </div>
                <div>
                  <div className="font-pa-body text-[11px] uppercase tracking-wide text-pa-grey-03">
                    Total target after
                  </div>
                  <div data-testid="mass-total-after" className="font-pa-mono text-xl font-bold text-pa-grey-04">
                    £{totalAfter.toLocaleString()}k
                  </div>
                </div>
                <div>
                  <div className="font-pa-body text-[11px] uppercase tracking-wide text-pa-grey-03">
                    Aggregate impact
                  </div>
                  <div
                    data-testid="mass-net-change"
                    className="font-pa-mono text-xl font-bold"
                    style={{
                      color:
                        netChange > 0
                          ? 'var(--color-pa-lime-04)'
                          : netChange < 0
                            ? 'var(--color-pa-rose-04)'
                            : 'var(--color-pa-grey-04)',
                    }}
                  >
                    {netChange >= 0 ? '+' : '−'}£{Math.abs(netChange).toLocaleString()}k
                    <span className="ml-1.5 font-pa-body text-xs font-medium text-pa-grey-03">
                      ({netChangePct >= 0 ? '+' : ''}
                      {netChangePct}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ---- Per-person preview: the same quantity that gets applied ---- */}
            <div className="rounded-pa-card bg-pa-white p-8">
              <h2 className="font-pa-display text-sm font-semibold text-pa-grey-04">
                Before and after, per person
              </h2>
              <p className="mt-1 font-pa-body text-xs text-pa-grey-03">
                These are the target values that will be written — not a separate revenue figure.
              </p>

              <div data-testid="mass-preview-rows" className="mt-4 flex flex-col gap-2">
                {visibleRows.map(({ person, before, after }) => (
                  <div
                    key={person.id}
                    data-testid="mass-preview-row"
                    data-person-id={person.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-pa-chip px-5 py-3"
                    style={{ background: 'var(--color-pa-grey-wash)' }}
                  >
                    <span className="font-pa-body text-sm font-semibold text-pa-grey-04">{person.name}</span>
                    <span className="font-pa-body text-xs text-pa-grey-03">
                      {person.division} / {person.team}
                    </span>
                    <span className="ml-auto flex items-center gap-3 font-pa-mono text-sm">
                      <span className="text-pa-grey-03">£{before}k</span>
                      <span aria-hidden="true" className="text-pa-grey-02">
                        →
                      </span>
                      <span data-testid="mass-preview-after" className="font-bold text-pa-grey-04">
                        £{after}k
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              {preview.length > PREVIEW_ROWS && (
                <button
                  type="button"
                  data-testid="mass-show-all"
                  onClick={() => setShowAllRows((v) => !v)}
                  className="mt-4 rounded-full bg-pa-grey-01 px-4 py-2 font-pa-body text-xs font-semibold text-pa-grey-04 transition-colors hover:bg-pa-grey-02/60"
                >
                  {showAllRows ? 'Show fewer' : `Show all ${preview.length}`}
                </button>
              )}
            </div>

            {crossCheck && <MassAdjustmentCrossCheckPanel result={crossCheck} />}

            {/* ---- Reason + confirm ---- */}
            <div className="rounded-pa-card bg-pa-white p-8">
              <label className="block font-pa-body text-xs font-medium text-pa-grey-03">
                Reason (required)
                <textarea
                  data-testid="mass-reason-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Why is this change being made?"
                  className="mt-1.5 w-full rounded-pa-chip border border-pa-grey-02 bg-pa-white px-3 py-2 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-03"
                />
              </label>

              {/*
                Sign-off gate, matching Manager Override's treatment: amber
                and explanatory, never a greyed-out control. The model does
                not block a manager — the change simply routes to leadership
                rather than applying immediately.
              */}
              {signOffPersonIds.length > 0 && (
                <div
                  data-testid="mass-signoff-gate"
                  className="mt-4 rounded-pa-card p-4"
                  style={{ background: 'var(--color-pa-apricot-01)' }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill state="Pending Sign-off" />
                    <span className="font-pa-body text-sm font-semibold text-pa-grey-04">
                      {signOffPersonIds.length === eligible.length
                        ? 'This whole batch needs sign-off.'
                        : `${signOffPersonIds.length} of these need sign-off.`}
                    </span>
                  </div>
                  <p className="mt-2 font-pa-body text-sm text-pa-grey-04">
                    Those records go to their team&apos;s leadership group to approve or reject, and appear in the
                    Exceptions queue. Nothing is blocked — you can still apply it.
                  </p>
                </div>
              )}

              <button
                type="button"
                data-testid="mass-apply-button"
                disabled={!canApply}
                onClick={handleApply}
                className={`mt-4 rounded-full px-5 py-2.5 font-pa-body text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  signOffPersonIds.length > 0
                    ? 'text-pa-dark-blue'
                    : 'bg-pa-aqua-05 text-pa-white hover:bg-pa-aqua-04'
                }`}
                style={
                  signOffPersonIds.length > 0
                    ? { background: 'var(--color-pa-state-pending-signoff)' }
                    : undefined
                }
              >
                {signOffPersonIds.length > 0
                  ? `Apply to ${eligible.length} · ${signOffPersonIds.length} for sign-off`
                  : `Apply to ${eligible.length} ${eligible.length === 1 ? 'person' : 'people'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
