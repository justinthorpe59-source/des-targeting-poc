import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store, type TargetStatus } from '../../store/system1Store'
import { detectExceptions } from '../engine/exceptions'
import { combinedRevenueFor } from '../engine/revenueEngine'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchDistribution } from '../../components/searchlight/SketchIllustrations'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'

const STATUS_ORDER: TargetStatus[] = ['Modelled', 'Adjusted', 'Pending Sign-off', 'Proposed', 'Approved']

// Workflow-stage colours (not risk severity) — a neutral→aqua progression
// that ends on Lime for Approved (done) and flags Pending Sign-off in
// Apricot (needs attention), all from the PA token set.
const STATUS_FILL: Record<TargetStatus, string> = {
  Modelled: 'var(--color-pa-grey-02)',
  Adjusted: 'var(--color-pa-aqua-02)',
  'Pending Sign-off': 'var(--color-pa-apricot-03)',
  Proposed: 'var(--color-pa-aqua-03)',
  Approved: 'var(--color-pa-lime-03)',
}

function MetricCell({
  label,
  value,
  sub,
  rule,
  testId,
  to,
}: {
  label: string
  value: ReactNode
  sub?: string
  rule: string
  testId: string
  to?: string
}) {
  const body = (
    <div className="relative h-full px-4 py-3">
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: rule }} />
      <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">{label}</div>
      <div data-testid={testId} className="mt-1 font-pa-mono text-lg font-bold text-pa-grey-04">
        {value}
      </div>
      {sub && <div className="mt-0.5 font-pa-body text-[11px] text-pa-grey-03">{sub}</div>}
    </div>
  )
  return to ? (
    <Link to={to} className="block transition-opacity hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  )
}

// M3: population summary. Tracks two distinct totals — the pure baseline-
// formula model output (aggregateModelled, unaffected by any override) and
// the combined revenue total (aggregateCurrent — billable + sales-target
// revenue, the real-economics figure that also rolls up into System 2).
// Everything here is derived live from the shared store — nothing is
// hardcoded. Searchlight design pass: presentation only, same figures.
export function Overview() {
  const targets = useSystem1Store((state) => state.targets)
  const loading = useInitialLoad(true)

  const stats = useMemo(() => {
    const total = SEED_PEOPLE.length
    const statusCounts: Record<TargetStatus, number> = {
      Modelled: 0,
      Adjusted: 0,
      'Pending Sign-off': 0,
      Proposed: 0,
      Approved: 0,
    }
    let aggregateModelled = 0
    let aggregateCurrent = 0
    let aggregateBaseline = 0

    for (const person of SEED_PEOPLE) {
      const target = targets[person.id]
      aggregateBaseline += person.baseline
      if (target) {
        statusCounts[target.status] += 1
        aggregateModelled += target.modelled
        aggregateCurrent += combinedRevenueFor(person)
      }
    }

    const exceptionsByPerson = detectExceptions({ people: SEED_PEOPLE, targets })

    return {
      total,
      statusCounts,
      aggregateModelled,
      aggregateCurrent,
      aggregateBaseline,
      openExceptions: exceptionsByPerson.size,
    }
  }, [targets])

  const pct = (n: number) => (stats.total === 0 ? 0 : Math.round((n / stats.total) * 100))
  const hasOverrides = stats.aggregateCurrent !== stats.aggregateModelled
  const approved = stats.statusCounts.Approved

  return (
    <section className="relative space-y-8">
      <SketchDistribution className="pointer-events-none absolute left-1/2 top-16 -z-10 h-[420px] w-[860px] max-w-none -translate-x-1/2 opacity-[0.06]" />

      <div>
        <h1 className="font-pa-display text-4xl font-semibold leading-tight text-pa-grey-04">Overview</h1>
        <p className="mt-1 font-pa-body text-sm text-pa-grey-03">
          Population summary across DES — Design, Engineering &amp; Science.
        </p>
      </div>

      {loading ? (
        <SearchlightLoader />
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-8">
          <p className="max-w-2xl font-pa-body text-base text-pa-grey-04">
            <span className="font-pa-mono font-semibold">{approved}</span> of{' '}
            <span className="font-pa-mono font-semibold">{stats.total}</span> targets approved · forecasting{' '}
            <span className="font-pa-mono font-semibold">£{stats.aggregateCurrent.toLocaleString()}k</span> aggregate
            current revenue
            {stats.openExceptions > 0 ? (
              <>
                {' '}·{' '}
                <span className="text-pa-grey-04">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: 'var(--color-pa-apricot-03)' }} />
                  <span className="font-pa-mono font-semibold">{stats.openExceptions}</span> open exception
                  {stats.openExceptions === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              ' · no open exceptions'
            )}
            .
          </p>

          {/* Population workflow — a single stacked bar of where the whole
              population sits in the Modelled → Approved pipeline. */}
          <div>
            <h2 className="mb-2 font-pa-display text-sm font-semibold text-pa-grey-04">Population workflow</h2>
            <div className="flex h-8 w-full overflow-hidden rounded-lg border border-pa-grey-01 bg-pa-white">
              {STATUS_ORDER.map((status) =>
                stats.statusCounts[status] > 0 ? (
                  <div
                    key={status}
                    className="h-full"
                    style={{ width: `${pct(stats.statusCounts[status])}%`, background: STATUS_FILL[status] }}
                    title={`${status}: ${stats.statusCounts[status]}`}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {STATUS_ORDER.map((status) => (
                <span key={status} className="flex items-center gap-1.5 font-pa-body text-xs text-pa-grey-03">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_FILL[status] }} />
                  {status}
                  <span className="font-pa-mono text-pa-grey-04">{stats.statusCounts[status]}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Headline metrics — one divided white surface. */}
          <div className="grid grid-cols-2 divide-x divide-y divide-pa-grey-01 overflow-hidden rounded-xl border border-pa-grey-01 bg-pa-white sm:grid-cols-4 sm:divide-y-0">
            <MetricCell
              label="Population"
              testId="stat-population"
              value={stats.total}
              sub="people across DES"
              rule="var(--color-pa-grey-02)"
            />
            <MetricCell
              label="Aggregate current target"
              testId="stat-aggregate-current"
              value={`£${stats.aggregateCurrent.toLocaleString()}k`}
              sub={
                hasOverrides
                  ? `£${stats.aggregateModelled.toLocaleString()}k modelled before overrides`
                  : `vs £${stats.aggregateBaseline.toLocaleString()}k combined baseline`
              }
              rule="var(--color-pa-aqua-04)"
            />
            <MetricCell
              label="Aggregate modelled target"
              testId="stat-aggregate-modelled"
              value={`£${stats.aggregateModelled.toLocaleString()}k`}
              sub="unaffected by overrides"
              rule="var(--color-pa-aqua-03)"
            />
            <MetricCell
              label="Open exceptions"
              testId="stat-open-exceptions"
              value={stats.openExceptions}
              sub="view the queue →"
              rule={stats.openExceptions > 0 ? 'var(--color-pa-apricot-03)' : 'var(--color-pa-lime-03)'}
              to="/system1/exceptions"
            />
          </div>

          {/* Status breakdown — % of population in each workflow stage. */}
          <div>
            <h2 className="mb-2 font-pa-display text-sm font-semibold text-pa-grey-04">Target status</h2>
            <div className="grid grid-cols-2 divide-x divide-y divide-pa-grey-01 overflow-hidden rounded-xl border border-pa-grey-01 bg-pa-white sm:grid-cols-5 sm:divide-y-0">
              {STATUS_ORDER.map((status) => (
                <div key={status} className="relative px-4 py-3">
                  <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: STATUS_FILL[status] }} />
                  <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
                    {status}
                  </div>
                  <div
                    data-testid={`stat-status-${status.toLowerCase()}`}
                    className="mt-1 font-pa-mono text-lg font-bold text-pa-grey-04"
                  >
                    {pct(stats.statusCounts[status])}%
                  </div>
                  <div className="mt-0.5 font-pa-body text-[11px] text-pa-grey-03">
                    {stats.statusCounts[status]} of {stats.total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
