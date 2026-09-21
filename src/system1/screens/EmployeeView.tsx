import { useNavigate, useParams } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store, type TargetStatus } from '../../store/system1Store'
import { explainTarget } from '../engine/explainTarget'
import { combinedRevenueFor } from '../engine/revenueEngine'
import { computeRevenueCohortAverages } from '../engine/cohortAverages'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function deltaLabel(value: number, baseline: number): string {
  if (baseline === 0) return ''
  const pct = Math.round(((value - baseline) / baseline) * 100)
  if (pct === 0) return 'in line with'
  return pct > 0 ? `${pct}% above` : `${Math.abs(pct)}% below`
}

const STATUS_DOT: Record<TargetStatus, string> = {
  Modelled: 'var(--color-pa-grey-02)',
  Adjusted: 'var(--color-pa-aqua-03)',
  'Pending Sign-off': 'var(--color-pa-apricot-03)',
  Proposed: 'var(--color-pa-aqua-04)',
  Approved: 'var(--color-pa-lime-03)',
}

/**
 * M12: read-only. Own target + explanation + notes, anonymised cohort
 * averages only — change history is deliberately excluded. A dead end by
 * design: nothing here links to Population, the Cohort picker, Override, or
 * anyone else's detail. Searchlight design pass: symmetric editorial profile
 * (reference-led), read-only, same shared functions as Individual Detail.
 * The "viewing as" picker is a demo affordance (no real sign-in in this POC).
 */
export function EmployeeView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const targets = useSystem1Store((state) => state.targets)
  const loading = useInitialLoad(true)

  const sortedPeople = [...SEED_PEOPLE].sort((a, b) => a.name.localeCompare(b.name))
  const person = id ? SEED_PEOPLE.find((p) => p.id === id) : undefined
  const target = person ? targets[person.id] : undefined
  const averages = person ? computeRevenueCohortAverages(person, SEED_PEOPLE) : null

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-pa-display text-3xl font-semibold leading-tight text-pa-grey-04">Your target</h1>
        <p className="mt-1 font-pa-body text-sm text-pa-grey-03">
          Read-only. Your target, why it is what it is, any notes your manager has added, and how it compares to
          team/division averages — nothing about anyone else.
        </p>
      </div>

      <label className="flex flex-col gap-1 font-pa-body text-xs font-medium text-pa-grey-03">
        Viewing as (demo only — this app has no real sign-in)
        <select
          data-testid="employee-person-select"
          className="max-w-sm rounded-md border border-pa-grey-02 bg-pa-white px-2 py-1.5 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-03"
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

      {loading ? (
        <SearchlightLoader />
      ) : person && target && averages ? (
        <div className="animate-[pa-fade-in_500ms_ease-out] overflow-hidden rounded-2xl border border-pa-grey-01 bg-pa-white">
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between font-pa-body text-[11px] font-medium uppercase tracking-[0.28em] text-pa-grey-03">
              <span>Profile</span>
              <span className="font-pa-mono tracking-normal">{person.id}</span>
            </div>

            {/* Portrait + hero numeral */}
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex flex-col">
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-pa-grey-01 bg-pa-grey-wash font-pa-mono text-2xl font-bold text-pa-aqua-05">
                  {initials(person.name)}
                </div>
                <h2 className="mt-4 font-pa-display text-4xl font-semibold leading-none text-pa-grey-04">
                  {person.name}
                </h2>
                <div className="mt-3 font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
                  {person.grade}
                </div>
                <div className="mt-0.5 font-pa-body text-sm text-pa-grey-04">
                  {person.division} · {person.location}
                </div>
              </div>

              <div className="flex flex-col sm:items-end sm:text-right">
                <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
                  Revenue contribution
                </div>
                <div data-testid="employee-target" className="font-pa-mono text-5xl font-bold leading-none text-pa-grey-04">
                  £{combinedRevenueFor(person)}k
                </div>
                <div className="mt-3 flex items-center gap-2 font-pa-body text-xs text-pa-grey-04 sm:justify-end">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_DOT[target.status] }} />
                  <span data-testid="employee-status" className="font-medium uppercase tracking-wide">
                    {target.status}
                  </span>
                </div>
                {!target.override && (
                  <div className="mt-2 font-pa-mono text-sm text-pa-grey-03">
                    range £{target.rangeLow}k – £{target.rangeHigh}k
                  </div>
                )}
              </div>
            </div>

            {target.status === 'Pending Sign-off' && (
              <p
                data-testid="employee-pending-signoff-banner"
                className="mt-6 rounded-md bg-pa-apricot-01 p-3 font-pa-body text-xs text-pa-grey-04"
              >
                This change is under review by your team&apos;s leadership group and hasn&apos;t been finalised yet.
              </p>
            )}

            {/* About */}
            <div className="mt-8 border-t border-pa-grey-01 pt-6">
              <div className="font-pa-body text-[11px] font-medium uppercase tracking-[0.28em] text-pa-grey-03">About</div>
              <p data-testid="employee-explanation" className="mt-2 font-pa-body text-sm leading-relaxed text-pa-grey-04">
                {explainTarget(person, target)}
              </p>
            </div>

            {/* Factors */}
            <div className="mt-6">
              <div className="font-pa-body text-[11px] font-medium uppercase tracking-[0.28em] text-pa-grey-03">
                Factors
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  `Baseline £${person.baseline}k`,
                  `Capacity ${person.capacity}`,
                  `Role ${person.roleFactor}`,
                  `Economic ${person.economicFactor}`,
                ].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-pa-grey-01 bg-pa-grey-wash px-3 py-1 font-pa-mono text-xs text-pa-grey-04"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="mt-6">
              <div className="font-pa-body text-[11px] font-medium uppercase tracking-[0.28em] text-pa-grey-03">
                Notes from your manager
              </div>
              {target.notes ? (
                <p data-testid="employee-notes" className="mt-2 font-pa-body text-sm text-pa-grey-04">
                  {target.notes}
                </p>
              ) : (
                <p data-testid="employee-notes-empty" className="mt-2 font-pa-body text-sm text-pa-grey-03">
                  No notes yet.
                </p>
              )}
            </div>
          </div>

          {/* How this compares — the calm bottom panel (dotted motif) */}
          <div
            className="border-t border-pa-grey-01 bg-pa-grey-wash p-6 sm:p-8"
            style={{
              backgroundImage: 'radial-gradient(var(--color-pa-grey-02) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
              backgroundPosition: 'right -6px top -6px',
            }}
          >
            <div className="font-pa-body text-[11px] font-medium uppercase tracking-[0.28em] text-pa-grey-03">
              How this compares
            </div>
            <p className="mt-1 font-pa-body text-xs text-pa-grey-03">
              Team and division averages — no individual colleague data.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="font-pa-body text-xs text-pa-grey-03">{person.team} team average</div>
                <div data-testid="employee-team-average" className="font-pa-mono text-xl font-bold text-pa-grey-04">
                  £{Math.round(averages.teamAverage)}k
                </div>
              </div>
              <div>
                <div className="font-pa-body text-xs text-pa-grey-03">{person.division} division average</div>
                <div data-testid="employee-division-average" className="font-pa-mono text-xl font-bold text-pa-grey-04">
                  £{Math.round(averages.divisionAverage)}k
                </div>
              </div>
            </div>
            <p data-testid="employee-comparison-sentence" className="mt-4 font-pa-body text-sm text-pa-grey-04">
              Your target is {deltaLabel(combinedRevenueFor(person), averages.teamAverage)} the team average and{' '}
              {deltaLabel(combinedRevenueFor(person), averages.divisionAverage)} the division average.
            </p>
          </div>
        </div>
      ) : (
        <p className="font-pa-body text-sm text-pa-grey-03">Select someone above to view their target.</p>
      )}
    </section>
  )
}
