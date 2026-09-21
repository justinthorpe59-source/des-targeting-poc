import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { DIVISIONS, LOCATIONS } from '../data/types'
import { ALL, ALL_TEAMS, DEFAULT_FILTER, filterPeople, type PopulationFilter } from '../engine/filterPeople'
import { combinedRevenueFor } from '../engine/revenueEngine'
import { computeMassAdjustmentCrossCheck } from '../engine/massAdjustmentCrossCheck'
import { buildMassSignOffContext } from '../engine/buildSignOffContext'
import { MassAdjustmentCrossCheckPanel } from '../components/MassAdjustmentCrossCheckPanel'
import { useSystem1Store } from '../../store/system1Store'
import { useSystem2LiveSnapshot } from '../../system2/bridge/useSystem2LiveState'

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none'

function FilterSelect({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  testId: string
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      <select data-testid={testId} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={ALL}>All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

// M10: mass adjustment. Filtering reuses filterPeople() (M4) — same
// mechanism as Population view, not a second implementation. Applying
// reuses applyOverride() (M8) per person via the store's applyMassAdjustment
// loop. People who already have an individual override are excluded by
// design (confirmed with the user before building) — a broad action
// shouldn't silently overwrite a manager's earlier, specific decision.
export function MassAdjustment() {
  const [filter, setFilter] = useState<PopulationFilter>(DEFAULT_FILTER)
  const [percent, setPercent] = useState(0)
  const [reason, setReason] = useState('')
  const [lastApplied, setLastApplied] = useState<{ count: number; percent: number; signOffCount: number } | null>(null)

  const targets = useSystem1Store((state) => state.targets)
  const applyMassAdjustment = useSystem1Store((state) => state.applyMassAdjustment)
  const system2Snapshot = useSystem2LiveSnapshot()

  const filtered = useMemo(() => filterPeople(SEED_PEOPLE, filter), [filter])

  const { eligible, excluded } = useMemo(() => {
    const eligible: typeof filtered = []
    const excluded: typeof filtered = []
    for (const person of filtered) {
      const target = targets[person.id]
      if (target?.override) excluded.push(person)
      else eligible.push(person)
    }
    return { eligible, excluded }
  }, [filtered, targets])

  const preview = useMemo(() => {
    return eligible.map((person) => {
      const before = combinedRevenueFor(person)
      const after = Math.round(before * (1 + percent / 100))
      return { person, before, after }
    })
  }, [eligible, percent])

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
      crossCheck && signOffPersonIds.length > 0 ? buildMassSignOffContext(crossCheck, crypto.randomUUID()) : undefined
    applyMassAdjustment(
      eligible.map((p) => p.id),
      { percent, reason: reason.trim(), signOffPersonIds, signOffContextByPersonId },
    )
    setLastApplied({ count: eligible.length, percent, signOffCount: signOffPersonIds.length })
    setReason('')
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Mass adjustment</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Apply a percentage change to a filtered population. Percentage only — a reason is required, and
          nothing is applied until you confirm.
        </p>
      </div>

      {lastApplied && (
        <div data-testid="mass-adjustment-success" className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Applied {lastApplied.percent > 0 ? '+' : ''}
          {lastApplied.percent}% to {lastApplied.count} record{lastApplied.count === 1 ? '' : 's'}.
          {lastApplied.signOffCount > 0 && (
            <>
              {' '}
              {lastApplied.signOffCount} of those route to Pending Sign-off —{' '}
              <Link to="/system1/signoff" className="font-medium underline">
                view the Sign-off Queue →
              </Link>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <FilterSelect
          label="Division"
          value={filter.division}
          options={[...DIVISIONS]}
          onChange={(value) => setFilter((f) => ({ ...f, division: value as PopulationFilter['division'] }))}
          testId="mass-filter-division"
        />
        <FilterSelect
          label="Team"
          value={filter.team}
          options={ALL_TEAMS}
          onChange={(value) => setFilter((f) => ({ ...f, team: value }))}
          testId="mass-filter-team"
        />
        <FilterSelect
          label="Location"
          value={filter.location}
          options={[...LOCATIONS]}
          onChange={(value) => setFilter((f) => ({ ...f, location: value as PopulationFilter['location'] }))}
          testId="mass-filter-location"
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Percentage change
          <input
            data-testid="mass-percent-input"
            type="number"
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Aggregate impact</h2>
        <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">Eligible</div>
            <div data-testid="mass-eligible-count" className="text-xl font-bold tabular-nums text-slate-900">
              {eligible.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Total before</div>
            <div data-testid="mass-total-before" className="text-xl font-bold tabular-nums text-slate-900">
              £{totalBefore.toLocaleString()}k
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Total after</div>
            <div data-testid="mass-total-after" className="text-xl font-bold tabular-nums text-slate-900">
              £{totalAfter.toLocaleString()}k
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Net change</div>
            <div data-testid="mass-net-change" className="text-xl font-bold tabular-nums text-slate-900">
              {netChange >= 0 ? '+' : ''}
              £{netChange.toLocaleString()}k ({netChangePct >= 0 ? '+' : ''}
              {netChangePct}%)
            </div>
          </div>
        </div>
        {excluded.length > 0 && (
          <p data-testid="mass-excluded-note" className="mt-3 text-xs text-slate-500">
            {excluded.length} record{excluded.length === 1 ? '' : 's'} in this filter already{' '}
            {excluded.length === 1 ? 'has' : 'have'} an individual override and{' '}
            {excluded.length === 1 ? 'is' : 'are'} excluded from this mass adjustment: {excluded.map((p) => p.id).join(', ')}.
          </p>
        )}
      </div>

      <label className="block max-w-2xl text-xs font-medium text-slate-500">
        Reason (required)
        <textarea
          data-testid="mass-reason-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Why is this mass adjustment being made?"
        />
      </label>

      <button
        type="button"
        data-testid="mass-apply-button"
        disabled={!canApply}
        onClick={handleApply}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {crossCheck?.routing === 'whole-batch'
          ? `Apply to ${eligible.length} record${eligible.length === 1 ? '' : 's'} (routes to Pending Sign-off)`
          : crossCheck?.routing === 'outliers-only'
            ? `Apply to ${eligible.length} record${eligible.length === 1 ? '' : 's'} (${signOffPersonIds.length} route to Pending Sign-off)`
            : `Apply to ${eligible.length} record${eligible.length === 1 ? '' : 's'}`}
      </button>

      {crossCheck && <MassAdjustmentCrossCheckPanel result={crossCheck} />}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Division / Team</th>
              <th className="px-3 py-2 text-right">Before</th>
              <th className="px-3 py-2 text-right">After</th>
            </tr>
          </thead>
          <tbody data-testid="mass-preview-rows" className="divide-y divide-slate-100">
            {preview.map(({ person, before, after }) => (
              <tr key={person.id} data-testid="mass-preview-row" data-person-id={person.id}>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{person.id}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{person.name}</td>
                <td className="px-3 py-2 text-slate-600">
                  {person.division} / {person.team}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">£{before}k</td>
                <td data-testid="mass-preview-after" className="px-3 py-2 text-right tabular-nums text-slate-900">
                  £{after}k
                </td>
              </tr>
            ))}
            {preview.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                  No eligible records for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
