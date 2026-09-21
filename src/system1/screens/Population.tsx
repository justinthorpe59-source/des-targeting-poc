import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { DIVISIONS, LOCATIONS, type Person } from '../data/types'
import { ALL, ALL_TEAMS, DEFAULT_FILTER, filterPeople, type PopulationFilter } from '../engine/filterPeople'
import { groupPeople, GROUP_LEVELS, type GroupLevel } from '../engine/groupPeople'
import { useSystem1Store, type TargetStatus, type TargetRecord } from '../../store/system1Store'
import { finalTargetFor } from '../engine/finalTarget'
import { combinedRevenueFor } from '../engine/revenueEngine'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchNetwork } from '../../components/searchlight/SketchIllustrations'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'

const selectClass =
  'rounded-md border border-pa-grey-02 bg-pa-white px-2 py-1.5 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-03'

const STATUS_FILTER_OPTIONS: TargetStatus[] = ['Modelled', 'Adjusted', 'Pending Sign-off', 'Proposed', 'Approved']

const GROUP_LEVEL_LABELS: Record<GroupLevel, string> = {
  team: 'Team',
  division: 'Division',
  'des-wide': 'DES-wide',
  none: 'None (single cluster)',
}

// Workflow-stage colours (not risk severity) — the ring of each person
// bubble encodes where their target sits in the Modelled → Approved pipeline.
const STATUS_RING: Record<TargetStatus, string> = {
  Modelled: 'var(--color-pa-grey-02)',
  Adjusted: 'var(--color-pa-aqua-03)',
  'Pending Sign-off': 'var(--color-pa-apricot-03)',
  Proposed: 'var(--color-pa-aqua-04)',
  Approved: 'var(--color-pa-lime-03)',
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

// M4: filterable population. Searchlight design pass replaces the flat table
// with a clustered-bubble visualisation (per the product owner's reference):
// team/division/DES-wide grouping becomes cluster anchors, each person a
// bubble whose ring encodes target status, clicking through to Individual
// Detail. The SAME filterPeople()/groupPeople() logic drives the clusters —
// division/team/location/status filters and the group-by selector all still
// apply. Row-selection + bulk Propose/Approve and per-group collapse/expand
// were intentionally dropped from this screen in the design pass (they have
// no natural home in the bubble view) — single-record Propose/Approve still
// lives on Individual Detail.
export function Population() {
  const [filter, setFilter] = useState<PopulationFilter>(DEFAULT_FILTER)
  const [statusFilter, setStatusFilter] = useState<TargetStatus | typeof ALL>(ALL)
  const [groupLevel, setGroupLevel] = useState<GroupLevel>('team')
  const targets = useSystem1Store((state) => state.targets)
  const navigate = useNavigate()
  const loading = useInitialLoad(true)

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

  const filtersActive =
    filter.division !== ALL || filter.team !== ALL || filter.location !== ALL || statusFilter !== ALL

  return (
    <section className="relative space-y-6">
      <SketchNetwork className="pointer-events-none absolute right-0 top-4 -z-10 h-[340px] w-[340px] max-w-none opacity-[0.05]" />

      <div>
        <h1 className="font-pa-display text-3xl font-semibold leading-tight text-pa-grey-04">Population</h1>
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

      {loading ? (
        <SearchlightLoader />
      ) : clusters.length === 0 ? (
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
    </section>
  )
}
