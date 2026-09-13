import { useMemo } from 'react'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store, type TargetStatus } from '../../store/system1Store'
import { detectExceptions } from '../engine/exceptions'

const STATUS_ORDER: TargetStatus[] = ['Modelled', 'Adjusted', 'Proposed', 'Approved']

function StatCard({
  label,
  value,
  sub,
  testId,
}: {
  label: string
  value: string | number
  sub?: string
  testId: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div data-testid={testId} className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

// M3: population summary. Every number here is derived live from the shared
// store (SEED_PEOPLE + targets) — nothing is hardcoded, so an override or
// approval anywhere else in the app changes these numbers immediately.
export function Overview() {
  const targets = useSystem1Store((state) => state.targets)

  const stats = useMemo(() => {
    const total = SEED_PEOPLE.length
    const statusCounts: Record<TargetStatus, number> = { Modelled: 0, Adjusted: 0, Proposed: 0, Approved: 0 }
    let aggregateModelled = 0
    let aggregateBaseline = 0

    for (const person of SEED_PEOPLE) {
      const target = targets[person.id]
      aggregateBaseline += person.baseline
      if (target) {
        statusCounts[target.status] += 1
        aggregateModelled += target.modelled
      }
    }

    const exceptionsByPerson = detectExceptions({ people: SEED_PEOPLE, targets })

    return { total, statusCounts, aggregateModelled, aggregateBaseline, openExceptions: exceptionsByPerson.size }
  }, [targets])

  const pct = (n: number) => (stats.total === 0 ? 0 : Math.round((n / stats.total) * 100))

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Overview</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Population summary across DES — Design, Engineering &amp; Science.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Population" value={stats.total} testId="stat-population" />
        <StatCard
          label="Aggregate modelled target"
          value={`£${stats.aggregateModelled.toLocaleString()}k`}
          sub={`vs £${stats.aggregateBaseline.toLocaleString()}k combined baseline`}
          testId="stat-aggregate-modelled"
        />
        <StatCard label="Open exceptions" value={stats.openExceptions} testId="stat-open-exceptions" />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700">Target status</h2>
        <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATUS_ORDER.map((status) => (
            <StatCard
              key={status}
              label={status}
              value={`${pct(stats.statusCounts[status])}%`}
              sub={`${stats.statusCounts[status]} of ${stats.total}`}
              testId={`stat-status-${status.toLowerCase()}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
