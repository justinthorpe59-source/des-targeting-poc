import { useNavigate, useParams } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store } from '../../store/system1Store'
import { explainTarget } from '../engine/explainTarget'
import { finalTargetFor } from '../engine/finalTarget'
import { computeCohortAverages } from '../engine/cohortAverages'
import { StatusPipeline } from '../components/StatusPipeline'

function FactorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums text-slate-900">{value}</span>
    </div>
  )
}

function deltaLabel(value: number, baseline: number): string {
  if (baseline === 0) return ''
  const pct = Math.round(((value - baseline) / baseline) * 100)
  if (pct === 0) return 'in line with'
  return pct > 0 ? `${pct}% above` : `${Math.abs(pct)}% below`
}

/**
 * M12: read-only. Own target + explanation + notes, anonymised cohort
 * averages only — CLAUDE.md's own four content types, nothing more (change
 * history is deliberately excluded, confirmed with the user).
 *
 * This screen is a dead end by design: no link anywhere on this page points
 * to Population, the named Cohort comparison picker, Exceptions queue,
 * Override, Mass adjustment, or any other person's Individual Detail. The
 * "viewing as" picker below is a demo-only affordance (there's no real auth
 * in this POC) — explanation and cohort averages both come from the same
 * shared functions Individual Detail and Cohort Comparison use (explainTarget,
 * computeCohortAverages), so there's no second implementation to drift.
 */
export function EmployeeView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const targets = useSystem1Store((state) => state.targets)

  const sortedPeople = [...SEED_PEOPLE].sort((a, b) => a.name.localeCompare(b.name))
  const person = id ? SEED_PEOPLE.find((p) => p.id === id) : undefined
  const target = person ? targets[person.id] : undefined
  const averages = person ? computeCohortAverages(person, SEED_PEOPLE, targets) : null

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Your target</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Read-only. Your target, why it is what it is, any notes your manager has added, and how it compares
          to team/division averages — nothing about anyone else.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Viewing as (demo only — this app has no real sign-in)
        <select
          data-testid="employee-person-select"
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
          value={person?.id ?? ''}
          onChange={(e) => navigate(`/system1/employee/${e.target.value}`)}
        >
          <option value="" disabled>
            Select…
          </option>
          {sortedPeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>
      </label>

      {person && target && averages ? (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Current target</h2>
              <span data-testid="employee-status" className="text-xs font-medium text-slate-500">
                {target.status}
              </span>
            </div>
            <div className="mt-3">
              <StatusPipeline current={target.status} />
            </div>
            <div data-testid="employee-target" className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
              £{finalTargetFor(target)}k
            </div>
            {!target.override && (
              <div className="text-sm text-slate-500">
                Range £{target.rangeLow}k – £{target.rangeHigh}k
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">Factor breakdown</h2>
            <div className="mt-2">
              <FactorRow label="Baseline (£k)" value={`£${person.baseline}k`} />
              <FactorRow label="Capacity factor" value={String(person.capacity)} />
              <FactorRow label="Role factor" value={`${person.roleFactor} (${person.roleTitle})`} />
              <FactorRow label="Economic factor" value={String(person.economicFactor)} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">Explanation</h2>
            <p data-testid="employee-explanation" className="mt-2 text-sm leading-relaxed text-slate-700">
              {explainTarget(person, target)}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">Notes from your manager</h2>
            {target.notes ? (
              <p data-testid="employee-notes" className="mt-2 text-sm text-slate-700">
                {target.notes}
              </p>
            ) : (
              <p data-testid="employee-notes-empty" className="mt-2 text-sm text-slate-500">
                No notes yet.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">How this compares</h2>
            <p className="mt-1 text-xs text-slate-500">Team and division averages — no individual colleague data.</p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">{person.team} team average</div>
                <div data-testid="employee-team-average" className="text-lg font-bold tabular-nums text-slate-900">
                  £{Math.round(averages.teamAverage)}k
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{person.division} division average</div>
                <div
                  data-testid="employee-division-average"
                  className="text-lg font-bold tabular-nums text-slate-900"
                >
                  £{Math.round(averages.divisionAverage)}k
                </div>
              </div>
            </div>
            <p data-testid="employee-comparison-sentence" className="mt-3 text-sm text-slate-600">
              Your target is {deltaLabel(finalTargetFor(target), averages.teamAverage)} the team average and{' '}
              {deltaLabel(finalTargetFor(target), averages.divisionAverage)} the division average.
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">Select someone above to view their target.</p>
      )}
    </section>
  )
}
