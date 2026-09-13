import { useNavigate, useParams } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store } from '../../store/system1Store'
import { computeCohortAverages } from '../engine/cohortAverages'

function ComparisonBar({ label, value, max, testId }: { label: string; value: number; max: number; testId: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span data-testid={testId} className="font-semibold tabular-nums text-slate-900">
          £{Math.round(value)}k
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

function deltaLabel(value: number, baseline: number): string {
  if (baseline === 0) return ''
  const pct = Math.round(((value - baseline) / baseline) * 100)
  if (pct === 0) return 'in line with'
  return pct > 0 ? `${pct}% above` : `${Math.abs(pct)}% below`
}

// M6: person vs team avg vs division avg. Averaging logic lives in
// cohortAverages.ts, shared with M3's exceptions detector rather than
// re-implemented here.
export function CohortComparison() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const targets = useSystem1Store((state) => state.targets)

  const sortedPeople = [...SEED_PEOPLE].sort((a, b) => a.name.localeCompare(b.name))
  const person = id ? SEED_PEOPLE.find((p) => p.id === id) : undefined
  const target = person ? targets[person.id] : undefined

  const averages = person ? computeCohortAverages(person, SEED_PEOPLE, targets) : null
  const max = averages && target ? Math.max(target.modelled, averages.teamAverage, averages.divisionAverage) : 0

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Cohort comparison</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          See how a person's modelled target compares to their team and division averages.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Person
        <select
          data-testid="cohort-person-select"
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
          value={person?.id ?? ''}
          onChange={(e) => navigate(`/system1/cohort/${e.target.value}`)}
        >
          <option value="" disabled>
            Select a person…
          </option>
          {sortedPeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>
      </label>

      {person && target && averages ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">
            {person.name} — {person.division} / {person.team}
          </h2>
          <div className="mt-4 space-y-4">
            <ComparisonBar label={`${person.name} (this person)`} value={target.modelled} max={max} testId="cohort-person-value" />
            <ComparisonBar label={`${person.team} team average`} value={averages.teamAverage} max={max} testId="cohort-team-value" />
            <ComparisonBar
              label={`${person.division} division average`}
              value={averages.divisionAverage}
              max={max}
              testId="cohort-division-value"
            />
          </div>
          <p className="mt-4 text-sm text-slate-600">
            £{target.modelled}k is {deltaLabel(target.modelled, averages.teamAverage)} the {person.team} team average
            (£{Math.round(averages.teamAverage)}k), and {deltaLabel(target.modelled, averages.divisionAverage)} the{' '}
            {person.division} division average (£{Math.round(averages.divisionAverage)}k).
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Select a person above to see their comparison.</p>
      )}
    </section>
  )
}
