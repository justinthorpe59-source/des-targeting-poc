import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SEED_PEOPLE } from '../data/people'
import { DIVISIONS, LOCATIONS, type Person } from '../data/types'
import { ALL, ALL_TEAMS, DEFAULT_FILTER, filterPeople, type PopulationFilter } from '../engine/filterPeople'
import { groupPeople, GROUP_LEVELS, type GroupLevel } from '../engine/groupPeople'
import { useSystem1Store, type TargetStatus, type TargetRecord } from '../../store/system1Store'
import { detectExceptions } from '../engine/exceptions'
import { finalTargetFor } from '../engine/finalTarget'
import { combinedRevenueFor } from '../engine/revenueEngine'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchDistribution, SketchNetwork } from '../../components/searchlight/SketchIllustrations'
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

// Same pipeline, encoded on the ring of each person bubble.
const STATUS_RING: Record<TargetStatus, string> = {
  Modelled: 'var(--color-pa-grey-02)',
  Adjusted: 'var(--color-pa-aqua-03)',
  'Pending Sign-off': 'var(--color-pa-apricot-03)',
  Proposed: 'var(--color-pa-aqua-04)',
  Approved: 'var(--color-pa-lime-03)',
}

const selectClass =
  'rounded-md border border-pa-grey-02 bg-pa-white px-2 py-1.5 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-03'

const STATUS_FILTER_OPTIONS: TargetStatus[] = ['Modelled', 'Adjusted', 'Pending Sign-off', 'Proposed', 'Approved']

const GROUP_LEVEL_LABELS: Record<GroupLevel, string> = {
  team: 'Team',
  division: 'Division',
  'des-wide': 'DES-wide',
  none: 'None (single cluster)',
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

// Deterministic phyllotaxis (sunflower) placement of person bubbles in an
// annulus around a central team anchor — even spread at any headcount, pure
// maths, no layout library.
function clusterLayout(n: number) {
  const bubbleR = 19
  const anchorR = Math.min(74, 42 + n * 2.5)
  const rInner = anchorR + bubbleR + 8
  const rOuter = rInner + bubbleR * 1.7 * Math.sqrt(Math.max(n, 1))
  const size = 2 * (rOuter + bubbleR + 4)
  const center = size / 2
  const golden = Math.PI * (3 - Math.sqrt(5))
  const points = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n
    const r = rInner + (rOuter - rInner) * Math.sqrt(t)
    const a = i * golden
    return { x: center + r * Math.cos(a), y: center + r * Math.sin(a) }
  })
  return { size, center, anchorR, bubbleR, points }
}

function BubbleCluster({
  label,
  people,
  combinedRevenue,
  targets,
  onOpen,
}: {
  label: string
  people: Person[]
  combinedRevenue: number
  targets: Record<string, TargetRecord | undefined>
  onOpen: (id: string) => void
}) {
  const layout = clusterLayout(people.length)
  return (
    <div className="relative shrink-0" style={{ width: layout.size, height: layout.size }}>
      {/* Team anchor */}
      <div
        className="absolute flex flex-col items-center justify-center rounded-full border border-pa-grey-01 bg-pa-white text-center shadow-[0_1px_2px_rgba(2,77,120,0.04)]"
        style={{
          width: layout.anchorR * 2,
          height: layout.anchorR * 2,
          left: layout.center,
          top: layout.center,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="px-2 font-pa-display text-sm font-semibold leading-tight text-pa-grey-04">{label}</div>
        <div className="mt-0.5 font-pa-mono text-[11px] text-pa-grey-03">{people.length}</div>
        <div className="font-pa-mono text-[11px] text-pa-aqua-05">£{combinedRevenue.toLocaleString()}k</div>
      </div>

      {/* People */}
      {people.map((person, i) => {
        const p = layout.points[i]
        const target = targets[person.id]
        const ring = target ? STATUS_RING[target.status] : 'var(--color-pa-grey-02)'
        return (
          <button
            key={person.id}
            type="button"
            data-testid="population-bubble"
            data-person-id={person.id}
            onClick={() => onOpen(person.id)}
            title={`${person.name} · ${person.grade}${target ? ` · £${finalTargetFor(target)}k · ${target.status}` : ''}`}
            className="group absolute flex items-center justify-center rounded-full bg-pa-white font-pa-mono text-[11px] font-bold text-pa-grey-04 transition-transform duration-200 ease-out hover:z-20 hover:scale-[1.18] focus:z-20 focus:scale-[1.18] focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-04"
            style={{
              width: layout.bubbleR * 2,
              height: layout.bubbleR * 2,
              left: p.x,
              top: p.y,
              transform: 'translate(-50%, -50%)',
              border: `2px solid ${ring}`,
              animation: `pa-pop-in 360ms ease-out both`,
              animationDelay: `${Math.min(i * 12, 600)}ms`,
            }}
          >
            {initials(person.name)}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-pa-grey-04 px-2 py-1 font-pa-body text-[11px] font-medium text-pa-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
              {person.name}
              {target ? ` · £${finalTargetFor(target)}k` : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Consolidated screen 1 of 5 — "Overview & Population".
 *
 * Architectural merge of the former Overview.tsx (M3) and Population.tsx
 * (M4) into a single route. Both bodies are preserved verbatim, including
 * every data-testid, so M3's and M4's acceptance signals still hold: the
 * summary figures are derived live from the shared store, and the same
 * filterPeople()/groupPeople() logic drives the clusters.
 *
 * Deliberately NOT changed here: the consolidated spec's landing state is
 * one uniform bubble per TEAM drilling into a team-level card roster with
 * checkbox multi-select. That's new interaction + visual work against
 * searchlight-visual-spec.md, so it belongs to the visual rebuild phase,
 * not this pure routing merge. Today the screen keeps M4's per-person
 * clusters and its division/team/location/status filters.
 */
export function OverviewPopulation() {
  const targets = useSystem1Store((state) => state.targets)
  const navigate = useNavigate()
  const loading = useInitialLoad(true)

  const [filter, setFilter] = useState<PopulationFilter>(DEFAULT_FILTER)
  const [statusFilter, setStatusFilter] = useState<TargetStatus | typeof ALL>(ALL)
  const [groupLevel, setGroupLevel] = useState<GroupLevel>('team')

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

  const filtered = useMemo(() => {
    const base = filterPeople(SEED_PEOPLE, filter)
    if (statusFilter === ALL) return base
    return base.filter((p) => targets[p.id]?.status === statusFilter)
  }, [filter, statusFilter, targets])

  const clusters = useMemo(() => {
    if (groupLevel === 'none') {
      const combined = filtered.reduce((sum, p) => sum + combinedRevenueFor(p), 0)
      return filtered.length > 0 ? [{ key: 'all', label: 'All filtered', people: filtered, combinedRevenue: combined }] : []
    }
    return groupPeople(filtered, groupLevel)
  }, [filtered, groupLevel])

  const pct = (n: number) => (stats.total === 0 ? 0 : Math.round((n / stats.total) * 100))
  const hasOverrides = stats.aggregateCurrent !== stats.aggregateModelled
  const approved = stats.statusCounts.Approved
  const filtersActive =
    filter.division !== ALL || filter.team !== ALL || filter.location !== ALL || statusFilter !== ALL

  return (
    <section className="relative space-y-8">
      <SketchDistribution className="pointer-events-none absolute left-1/2 top-16 -z-10 h-[420px] w-[860px] max-w-none -translate-x-1/2 opacity-[0.06]" />

      <div>
        <h1 className="font-pa-display text-4xl font-semibold leading-tight text-pa-grey-04">
          Overview &amp; Population
        </h1>
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

          {/* ---- Population view (former Population.tsx / M4) ---- */}
          <div className="relative space-y-6 border-t border-pa-grey-01 pt-8">
            <SketchNetwork className="pointer-events-none absolute right-0 top-4 -z-10 h-[340px] w-[340px] max-w-none opacity-[0.05]" />

            <div>
              <h2 className="font-pa-display text-3xl font-semibold leading-tight text-pa-grey-04">Population</h2>
              <p className="mt-1 max-w-xl font-pa-body text-sm text-pa-grey-03">
                Everyone in DES — Design, Engineering &amp; Science — clustered by team. Each bubble is a person;
                its ring shows their target status. Click through for the full profile.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 font-pa-body text-xs font-medium text-pa-grey-03">
                Division
                <select
                  data-testid="filter-division"
                  className={selectClass}
                  value={filter.division}
                  onChange={(e) => setFilter((f) => ({ ...f, division: e.target.value as PopulationFilter['division'] }))}
                >
                  <option value={ALL}>All</option>
                  {DIVISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 font-pa-body text-xs font-medium text-pa-grey-03">
                Team
                <select
                  data-testid="filter-team"
                  className={selectClass}
                  value={filter.team}
                  onChange={(e) => setFilter((f) => ({ ...f, team: e.target.value }))}
                >
                  <option value={ALL}>All</option>
                  {ALL_TEAMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 font-pa-body text-xs font-medium text-pa-grey-03">
                Location
                <select
                  data-testid="filter-location"
                  className={selectClass}
                  value={filter.location}
                  onChange={(e) => setFilter((f) => ({ ...f, location: e.target.value as PopulationFilter['location'] }))}
                >
                  <option value={ALL}>All</option>
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 font-pa-body text-xs font-medium text-pa-grey-03">
                Status
                <select
                  data-testid="filter-status"
                  className={selectClass}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TargetStatus | typeof ALL)}
                >
                  <option value={ALL}>All</option>
                  {STATUS_FILTER_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 font-pa-body text-xs font-medium text-pa-grey-03">
                Group by
                <select
                  data-testid="filter-group-level"
                  className={selectClass}
                  value={groupLevel}
                  onChange={(e) => setGroupLevel(e.target.value as GroupLevel)}
                >
                  {GROUP_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {GROUP_LEVEL_LABELS[level]}
                    </option>
                  ))}
                </select>
              </label>
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter(DEFAULT_FILTER)
                    setStatusFilter(ALL)
                  }}
                  className="rounded-md border border-pa-grey-02 px-3 py-1.5 font-pa-body text-sm font-medium text-pa-grey-04 hover:bg-pa-grey-01"
                >
                  Clear filters
                </button>
              )}
              <span data-testid="result-count" className="ml-auto font-pa-body text-sm text-pa-grey-03">
                Showing <span className="font-pa-mono">{filtered.length}</span> of{' '}
                <span className="font-pa-mono">{SEED_PEOPLE.length}</span>
              </span>
            </div>

            {clusters.length === 0 ? (
              <div className="rounded-lg border border-pa-grey-01 bg-pa-white p-6 text-center font-pa-body text-sm text-pa-grey-03">
                No one matches this filter combination.
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-2 rounded-xl border border-pa-grey-01 bg-pa-white/60 px-4 py-6">
                {clusters.map((cluster) => (
                  <BubbleCluster
                    key={cluster.key}
                    label={cluster.label}
                    people={cluster.people}
                    combinedRevenue={cluster.combinedRevenue}
                    targets={targets}
                    onOpen={(personId) => navigate(`/system1/person/${personId}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
