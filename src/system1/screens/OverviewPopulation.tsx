import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SEED_PEOPLE } from '../data/people'
import { LOCATIONS, type Location, type Person } from '../data/types'
import { useSystem1Store, type TargetStatus } from '../../store/system1Store'
import { useSnapshotStore } from '../../store/snapshotStore'
import { detectExceptions } from '../engine/exceptions'
import { buildSnapshot } from '../engine/buildSnapshot'
import { finalTargetFor } from '../engine/finalTarget'
import { combinedRevenueFor } from '../engine/revenueEngine'
import { StatusPill } from '../../components/searchlight/StatusPill'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchNetwork } from '../../components/searchlight/SketchIllustrations'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'

const STATUS_ORDER: TargetStatus[] = ['Modelled', 'Adjusted', 'Pending Sign-off', 'Proposed', 'Approved']

const STATE_TOKEN: Record<TargetStatus, string> = {
  Modelled: 'var(--color-pa-state-modelled)',
  Adjusted: 'var(--color-pa-state-adjusted)',
  'Pending Sign-off': 'var(--color-pa-state-pending-signoff)',
  Proposed: 'var(--color-pa-state-proposed)',
  Approved: 'var(--color-pa-state-approved)',
}

/** Connector colours, rotated across the network. PA tokens only — the
 *  reference image's own colours are never lifted. */
const CONNECTOR_TOKENS = [
  'var(--color-pa-aqua-03)',
  'var(--color-pa-apricot-03)',
  'var(--color-pa-rose-03)',
]

const ALL_LOCATIONS = 'All locations' as const
type LocationFilter = Location | typeof ALL_LOCATIONS

interface TeamNode {
  key: string
  division: string
  team: string
  people: Person[]
  combinedRevenue: number
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * The network canvas is a fixed virtual pixel space, converted to percentages
 * at render time so it scales with its container while the layout maths stays
 * in one readable unit.
 */
const VIEW_W = 1600
const VIEW_H = 820

const MEMBER_SIZE = 60
const MEMBER_GAP = 9
/** Half-extents of a team's name pill, used as a keep-out box. */
const PILL_HALF_W = 82
const PILL_HALF_H = 23

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

interface Placed {
  teamKey: string
  personId: string
  x: number
  y: number
  seedX: number
  seedY: number
}

/**
 * Anchor points for each team's name pill — evenly spaced around a wide
 * ellipse, with an alternating radius so the result reads organic rather
 * than as a regular polygon.
 *
 * Golden-angle placement was tried first: it distributes well at high counts
 * but at six it bunched three teams into one corner and left the opposite
 * side empty. Even angular spacing is what actually uses the full width.
 * Still a pure function of index and count, so the layout never shifts
 * between runs.
 */
function pillAnchors(count: number) {
  const cx = VIEW_W / 2
  const cy = VIEW_H / 2
  if (count === 1) return [{ x: cx, y: cy }]
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2
    const wobble = i % 2 === 0 ? 1 : 0.76
    return { x: cx + Math.cos(a) * 612 * wobble, y: cy + Math.sin(a) * 248 * wobble }
  })
}

/**
 * Lays out the whole network: one name pill per team, and one placeholder
 * bubble per team member scattered around its own pill.
 *
 * Members are seeded in an annulus around their pill (golden angle again, so
 * the scatter is irregular rather than a ring), then a deterministic
 * relaxation pass resolves every collision at once — bubble against bubble
 * across ALL teams, bubble against any pill, and bubble against the canvas
 * edge — while a weak spring back to its seed keeps each member visually
 * attached to its own team. No randomness anywhere, so the same population
 * always produces the same picture.
 */
function layoutNetwork(nodes: TeamNode[]) {
  const anchors = pillAnchors(nodes.length)
  const members: Placed[] = []

  nodes.forEach((node, ti) => {
    const anchor = anchors[ti]
    const n = node.people.length
    node.people.forEach((person, i) => {
      const t = (i + 0.5) / n
      const f = Math.sqrt(t)
      const rx = 88 + 34 * f
      const ry = 80 + 28 * f
      const a = i * GOLDEN + ti * 1.7
      const x = anchor.x + Math.cos(a) * rx
      const y = anchor.y + Math.sin(a) * ry
      members.push({ teamKey: node.key, personId: person.id, x, y, seedX: x, seedY: y })
    })
  })

  const minDist = MEMBER_SIZE + MEMBER_GAP
  const half = MEMBER_SIZE / 2
  const padX = PILL_HALF_W + half + 8
  const padY = PILL_HALF_H + half + 8

  const separate = () => {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const dx = members[j].x - members[i].x
        const dy = members[j].y - members[i].y
        const d = Math.hypot(dx, dy) || 0.01
        if (d >= minDist) continue
        const push = (minDist - d) / 2
        const ux = dx / d
        const uy = dy / d
        members[i].x -= ux * push
        members[i].y -= uy * push
        members[j].x += ux * push
        members[j].y += uy * push
      }
    }
  }

  const clearPills = () => {
    for (const m of members) {
      for (const a of anchors) {
        const dx = m.x - a.x
        const dy = m.y - a.y
        if (Math.abs(dx) >= padX || Math.abs(dy) >= padY) continue
        // shove out along whichever axis needs the smaller move
        if (padX - Math.abs(dx) < padY - Math.abs(dy)) {
          m.x = a.x + (dx >= 0 ? padX : -padX)
        } else {
          m.y = a.y + (dy >= 0 ? padY : -padY)
        }
      }
    }
  }

  const clampToCanvas = () => {
    for (const m of members) {
      m.x = Math.min(Math.max(m.x, half + 2), VIEW_W - half - 2)
      m.y = Math.min(Math.max(m.y, half + 2), VIEW_H - half - 2)
    }
  }

  // Phase 1 — shape the clusters: a weak spring home keeps each member
  // associated with its own team while collisions are worked out.
  for (let pass = 0; pass < 200; pass++) {
    for (const m of members) {
      m.x += (m.seedX - m.x) * 0.08
      m.y += (m.seedY - m.y) * 0.08
    }
    separate()
    clearPills()
    clampToCanvas()
  }

  // Phase 2 — settle: with the spring switched off, nothing pulls bubbles
  // back into contact, so alternating the two constraints converges on a
  // state that satisfies BOTH. Running them inside phase 1 could only ever
  // satisfy whichever ran last.
  for (let pass = 0; pass < 80; pass++) {
    clearPills()
    separate()
    clampToCanvas()
  }
  clearPills()

  // Connectors, restored after the structure change. In the reference the
  // dotted lines run between the PEOPLE circles, not between the labels, and
  // they are sparse — roughly one segment per pair of neighbours, not a line
  // per node. So: link consecutive teams by their two closest members, which
  // weaves a loose path across the whole canvas at the reference's density
  // (5 segments for 6 teams) rather than a spoke per person.
  const edges: Array<{ d: string; stroke: string }> = []
  for (let t = 0; t < nodes.length - 1; t++) {
    const from = members.filter((m) => m.teamKey === nodes[t].key)
    const to = members.filter((m) => m.teamKey === nodes[t + 1].key)
    if (from.length === 0 || to.length === 0) continue

    // Pick the SHORTEST pair that is still long enough to draw as a visible
    // dash run, falling back to the longest pair if every option is too
    // short. Taking the plain minimum skipped the link entirely whenever two
    // teams sat close, which silently broke the chain between them.
    const minDrawable = (half + 5) * 2 + 40
    let best: [Placed, Placed] | null = null
    let bestD = Infinity
    let longest: [Placed, Placed] | null = null
    let longestD = -1
    for (const a of from) {
      for (const b of to) {
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d > longestD) {
          longestD = d
          longest = [a, b]
        }
        if (d >= minDrawable && d < bestD) {
          bestD = d
          best = [a, b]
        }
      }
    }
    best = best ?? longest
    if (!best) continue

    const [a, b] = best
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    // start and end at the bubbles' edges, so the dashes sit in the gap
    const gap = half + 5
    const x1 = a.x + ux * gap
    const y1 = a.y + uy * gap
    const x2 = b.x - ux * gap
    const y2 = b.y - uy * gap
    const bow = (t % 2 === 0 ? 1 : -1) * Math.min(len * 0.2, 70)
    const mx = (x1 + x2) / 2 - uy * bow
    const my = (y1 + y2) / 2 + ux * bow
    edges.push({
      d: `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`,
      stroke: CONNECTOR_TOKENS[t % CONNECTOR_TOKENS.length],
    })
  }

  return { anchors, members, edges }
}

/**
 * A blank placeholder for one team member. Deliberately generic — no photo,
 * no initials, no text. Real headshots replace these later; until then it
 * reads as "a person" without inventing an identity.
 */
function MemberBubble({ x, y }: { x: number; y: number }) {
  return (
    <span
      aria-hidden="true"
      data-testid="member-bubble"
      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-pa-grey-02"
      style={{
        left: `${(x / VIEW_W) * 100}%`,
        top: `${(y / VIEW_H) * 100}%`,
        width: `${(MEMBER_SIZE / VIEW_W) * 100}%`,
        aspectRatio: '1',
        background: 'var(--color-pa-grey-01)',
      }}
    >
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="var(--color-pa-grey-02)" strokeWidth="1.9">
        <circle cx="12" cy="9" r="3.6" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeLinecap="round" />
      </svg>
    </span>
  )
}

/**
 * The team's name pill — the interactive affordance for the whole node.
 *
 * Deliberately NOT the shared StatusPill. The spec locks that component to
 * two semantic uses, workflow state and risk status, where the fill colour IS
 * the meaning. This carries no state: it is a neutral label, white on
 * elevation. Folding it in would dilute what a coloured pill signifies
 * everywhere else. Contains the team name and nothing else.
 */
function TeamPill({
  team,
  teamKey,
  x,
  y,
  onOpen,
}: {
  team: string
  teamKey: string
  x: number
  y: number
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      data-testid="team-node"
      data-team-key={teamKey}
      onClick={onOpen}
      style={{ left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%` }}
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-pa-grey-01 bg-pa-white px-6 py-3 font-pa-body text-base font-semibold text-pa-grey-04 shadow-[0_2px_12px_rgba(2,77,120,0.10)] transition-transform duration-200 ease-out hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-04 focus-visible:ring-offset-2"
    >
      {team}
    </button>
  )
}

function TeamBubbleNetwork({
  nodes,
  onOpen,
}: {
  nodes: TeamNode[]
  onOpen: (key: string) => void
}) {
  const { anchors, members, edges } = useMemo(() => layoutNetwork(nodes), [nodes])

  return (
    /* Full-bleed: the app shell constrains <main> to max-w-6xl, which left
       the network floating in the middle of a much wider screen. This breaks
       out of that container so the population actually uses the viewport,
       capped so it does not become absurdly tall on a very wide monitor. */
    <div
      className="relative left-1/2 w-screen max-w-[1600px] -translate-x-1/2 px-6"
      style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {edges.map((edge, i) => (
          <path
            key={i}
            d={edge.d}
            fill="none"
            stroke={edge.stroke}
            strokeWidth="2"
            strokeDasharray="6 9"
            strokeLinecap="round"
            opacity="0.9"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {members.map((m) => (
        <MemberBubble key={m.personId} x={m.x} y={m.y} />
      ))}
      {nodes.map((node, i) => (
        <TeamPill
          key={node.key}
          team={node.team}
          teamKey={node.key}
          x={anchors[i].x}
          y={anchors[i].y}
          onOpen={() => onOpen(node.key)}
        />
      ))}
    </div>
  )
}

/**
 * Roster card for the team list state.
 *
 * Per Justin's direction (25 Sept 2026), the spec's "two contact/data rows"
 * are deliberately absent: a person's data belongs on Individual Detail, not
 * repeated across the roster. The card carries identification, workflow
 * state, selection and navigation only.
 */
function PersonCard({
  person,
  status,
  target,
  selected,
  onToggle,
  onView,
  onNotes,
}: {
  person: Person
  status: TargetStatus | undefined
  target: number
  selected: boolean
  onToggle: () => void
  onView: () => void
  onNotes: () => void
}) {
  return (
    <div
      data-testid="person-card"
      data-person-id={person.id}
      data-selected={selected ? 'true' : 'false'}
      className={`flex flex-col rounded-pa-card border bg-pa-white p-4 transition-colors ${
        selected ? 'border-pa-aqua-04 ring-1 ring-pa-aqua-04' : 'border-pa-grey-01'
      }`}
    >
      <div className="flex items-start justify-between">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            data-testid="person-select"
            checked={selected}
            onChange={onToggle}
            className="h-4 w-4 accent-pa-aqua-04"
          />
          <span className="sr-only">Select {person.name} for mass adjustment</span>
        </label>
        <span className="font-pa-mono text-[11px] text-pa-grey-02">{person.id}</span>
      </div>

      <div className="mt-2 flex flex-col items-center text-center">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full font-pa-mono text-sm font-bold text-pa-white"
          style={{ background: 'var(--color-pa-aqua-05)' }}
        >
          {initials(person.name)}
        </span>
        <span className="mt-2 font-pa-body text-sm font-semibold text-pa-grey-04">{person.name}</span>
        <span className="font-pa-body text-xs text-pa-grey-03">{person.grade}</span>
        <span className="mt-2">{status && <StatusPill state={status} testId="person-card-status" />}</span>
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-pa-grey-01 pt-3">
        <span className="font-pa-body text-xs text-pa-grey-03">Current target</span>
        <span data-testid="person-card-target" className="font-pa-mono text-sm font-bold text-pa-grey-04">
          £{target}k
        </span>
      </div>

      <div className="mt-3 flex gap-2 border-t border-pa-grey-01 pt-3">
        <button
          type="button"
          data-testid="person-card-notes"
          onClick={onNotes}
          className="flex-1 rounded-full border border-pa-grey-02 px-3 py-1.5 font-pa-body text-xs font-semibold text-pa-grey-04 transition-colors hover:bg-pa-grey-wash"
        >
          Notes
        </button>
        <button
          type="button"
          data-testid="person-card-view"
          onClick={onView}
          className="flex-1 rounded-full bg-pa-aqua-05 px-3 py-1.5 font-pa-body text-xs font-semibold text-pa-white transition-colors hover:bg-pa-aqua-04"
        >
          View
        </button>
      </div>
    </div>
  )
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

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Former SnapshotExport.tsx (M13): last-synced status + manual re-export.
 *  Approve already writes to the bridge live, so this is the fallback path. */
function System2SyncStrip() {
  const targets = useSystem1Store((state) => state.targets)
  const lastSnapshot = useSnapshotStore((state) => state.lastSnapshot)
  const setSnapshot = useSnapshotStore((state) => state.setSnapshot)

  const preview = useMemo(() => buildSnapshot(SEED_PEOPLE, targets), [targets])
  const isStale = lastSnapshot !== null && lastSnapshot.recordCount !== preview.recordCount

  function handleExport() {
    const snapshot = buildSnapshot(SEED_PEOPLE, targets)
    setSnapshot(snapshot)
    downloadJson(`snapshot-${snapshot.exportedAt.replace(/[:.]/g, '-')}.json`, snapshot)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-pa-card border border-pa-grey-01 bg-pa-white px-4 py-3">
      <div>
        <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
          Last synced with System 2
        </div>
        {lastSnapshot ? (
          <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
            <span data-testid="export-last-count" className="font-pa-mono text-sm font-bold text-pa-grey-04">
              {lastSnapshot.recordCount} record{lastSnapshot.recordCount === 1 ? '' : 's'}
            </span>
            <span data-testid="export-last-timestamp" className="font-pa-mono text-[11px] text-pa-grey-03">
              {lastSnapshot.exportedAt}
            </span>
            {isStale && (
              <span
                data-testid="export-stale-warning"
                className="rounded-pa-chip px-1.5 py-0.5 font-pa-body text-[11px] text-pa-grey-04"
                style={{ background: 'var(--color-pa-apricot-01)' }}
              >
                Out of date — re-export to include the latest Approved records.
              </span>
            )}
          </div>
        ) : (
          <div data-testid="export-never" className="mt-0.5 font-pa-body text-sm text-pa-grey-03">
            Never exported
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="font-pa-body text-[11px] text-pa-grey-03">
          Approved records sync live ·{' '}
          <span data-testid="export-preview-count" className="font-pa-mono">
            {preview.recordCount}
          </span>{' '}
          approved now
        </span>
        <button
          type="button"
          data-testid="export-button"
          onClick={handleExport}
          disabled={preview.recordCount === 0}
          className="rounded-pa-chip bg-pa-aqua-05 px-3 py-1.5 font-pa-body text-sm font-medium text-pa-white hover:bg-pa-aqua-04 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Re-export ({preview.recordCount})
        </button>
      </div>
    </div>
  )
}

/**
 * Consolidated screen 1 of 5 — "Overview & Population", visual rebuild.
 *
 * Two states of ONE screen, never two routes:
 *   landing  — one uniform-size bubble per DES team, location as a filter
 *   drill-in — that team's roster, card per person, multi-select
 *
 * Sources, per the agreed precedence:
 *   - Composition of the network (scattered organic placement, dotted curved
 *     connectors, generous whitespace, centred heading over it) follows the
 *     supplied style reference.
 *   - Bubble granularity (per TEAM, uniform size), location-as-filter,
 *     drill-in-not-route, and the card's actions come from CLAUDE.md and
 *     searchlight-visual-spec.md, which govern data and behaviour.
 *   - Every colour is a PA token; nothing is lifted from the reference image.
 */
export function OverviewPopulation() {
  const targets = useSystem1Store((state) => state.targets)
  const selectedPersonIds = useSystem1Store((state) => state.selectedPersonIds)
  const togglePersonSelected = useSystem1Store((state) => state.togglePersonSelected)
  const setSelectedPersonIds = useSystem1Store((state) => state.setSelectedPersonIds)
  const navigate = useNavigate()
  const loading = useInitialLoad(true)

  const [locationFilter, setLocationFilter] = useState<LocationFilter>(ALL_LOCATIONS)
  const [openTeamKey, setOpenTeamKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const stats = useMemo(() => {
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
    return {
      total: SEED_PEOPLE.length,
      statusCounts,
      aggregateModelled,
      aggregateCurrent,
      aggregateBaseline,
      openExceptions: detectExceptions({ people: SEED_PEOPLE, targets }).size,
    }
  }, [targets])

  /** Teams surviving the location filter. A team shows if anyone on it sits
   *  in the selected location — location narrows the network, it never
   *  regroups it. */
  const teamNodes = useMemo<TeamNode[]>(() => {
    const byTeam = new Map<string, TeamNode>()
    for (const person of SEED_PEOPLE) {
      if (locationFilter !== ALL_LOCATIONS && person.location !== locationFilter) continue
      const key = `${person.division}::${person.team}`
      const node = byTeam.get(key) ?? {
        key,
        division: person.division,
        team: person.team,
        people: [],
        combinedRevenue: 0,
      }
      node.people.push(person)
      node.combinedRevenue += combinedRevenueFor(person)
      byTeam.set(key, node)
    }
    return [...byTeam.values()].sort((a, b) => a.key.localeCompare(b.key))
  }, [locationFilter])

  const openTeam = teamNodes.find((n) => n.key === openTeamKey) ?? null

  const roster = useMemo(() => {
    if (!openTeam) return []
    const q = search.trim().toLowerCase()
    if (!q) return openTeam.people
    return openTeam.people.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.grade.toLowerCase().includes(q),
    )
  }, [openTeam, search])

  const pct = (n: number) => (stats.total === 0 ? 0 : Math.round((n / stats.total) * 100))
  const hasOverrides = stats.aggregateCurrent !== stats.aggregateModelled
  const rosterSelectedCount = roster.filter((p) => selectedPersonIds.includes(p.id)).length

  return (
    <section className="relative space-y-10">
      <SketchNetwork className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[520px] w-[900px] max-w-none -translate-x-1/2 opacity-[0.05]" />

      {loading ? (
        <SearchlightLoader />
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-10">
          <System2SyncStrip />

          {/* Headline metrics */}
          <div className="grid grid-cols-2 divide-x divide-y divide-pa-grey-01 overflow-hidden rounded-pa-card border border-pa-grey-01 bg-pa-white sm:grid-cols-4 sm:divide-y-0">
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
              rule={
                stats.openExceptions > 0
                  ? 'var(--color-pa-state-pending-signoff)'
                  : 'var(--color-pa-state-approved)'
              }
              to="/system1/exceptions"
            />
          </div>

          {/* Workflow pipeline */}
          <div>
            <h2 className="mb-2 font-pa-display text-sm font-semibold text-pa-grey-04">Population workflow</h2>
            <div className="flex h-8 w-full overflow-hidden rounded-pa-chip border border-pa-grey-01 bg-pa-white">
              {STATUS_ORDER.map((status) =>
                stats.statusCounts[status] > 0 ? (
                  <div
                    key={status}
                    className="h-full"
                    style={{ width: `${pct(stats.statusCounts[status])}%`, background: STATE_TOKEN[status] }}
                    title={`${status}: ${stats.statusCounts[status]}`}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {STATUS_ORDER.map((status) => (
                <span key={status} className="flex items-center gap-1.5 font-pa-body text-xs text-pa-grey-03">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: STATE_TOKEN[status] }} />
                  {status}
                  <span
                    data-testid={`stat-status-${status.toLowerCase()}`}
                    className="font-pa-mono text-pa-grey-04"
                  >
                    {stats.statusCounts[status]}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* ---- Landing state: team bubble network ---- */}
          {!openTeam ? (
            <div className="space-y-6">
              <div className="mx-auto max-w-2xl text-center">
                <h1 className="font-pa-display text-4xl font-semibold leading-tight text-pa-grey-04">
                  Every team in DES,
                  <br />
                  and where their targets stand
                </h1>
                <p className="mx-auto mt-3 max-w-md font-pa-body text-sm text-pa-grey-03">
                  Pick a team to open its roster. Filter by location to narrow which teams show.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {[ALL_LOCATIONS, ...LOCATIONS].map((loc) => {
                  const active = locationFilter === loc
                  return (
                    <button
                      key={loc}
                      type="button"
                      data-testid="location-filter"
                      data-location={loc}
                      data-active={active ? 'true' : 'false'}
                      onClick={() => setLocationFilter(loc as LocationFilter)}
                      className={`rounded-full px-3 py-1.5 font-pa-body text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-pa-aqua-05 text-pa-white'
                          : 'border border-pa-grey-02 text-pa-grey-04 hover:bg-pa-white'
                      }`}
                    >
                      {loc}
                    </button>
                  )
                })}
              </div>

              {teamNodes.length === 0 ? (
                <p
                  data-testid="network-empty"
                  className="rounded-pa-card border border-pa-grey-01 bg-pa-white p-6 text-center font-pa-body text-sm text-pa-grey-03"
                >
                  No teams have anyone in {locationFilter}.
                </p>
              ) : (
                <TeamBubbleNetwork nodes={teamNodes} onOpen={(key) => setOpenTeamKey(key)} />
              )}

              <p data-testid="network-team-count" className="text-center font-pa-body text-xs text-pa-grey-03">
                {teamNodes.length} team{teamNodes.length === 1 ? '' : 's'}
                {locationFilter !== ALL_LOCATIONS ? ` with people in ${locationFilter}` : ' across DES'}
              </p>
            </div>
          ) : (
            /* ---- Drill-in state: team roster ---- */
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <button
                    type="button"
                    data-testid="roster-back"
                    onClick={() => {
                      setOpenTeamKey(null)
                      setSearch('')
                    }}
                    className="font-pa-body text-xs font-semibold text-pa-aqua-05 hover:text-pa-aqua-04"
                  >
                    ← All teams
                  </button>
                  <h1 className="mt-1 font-pa-display text-3xl font-semibold leading-tight text-pa-grey-04">
                    {openTeam.team}
                  </h1>
                  <p className="font-pa-body text-sm text-pa-grey-03">
                    {openTeam.division} · {openTeam.people.length} people ·{' '}
                    <span className="font-pa-mono">£{openTeam.combinedRevenue.toLocaleString()}k</span> combined
                  </p>
                </div>

                <input
                  type="search"
                  data-testid="roster-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search this team…"
                  className="w-56 rounded-pa-chip border border-pa-grey-02 bg-pa-white px-3 py-1.5 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-03"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-pa-card border border-pa-grey-01 bg-pa-white px-4 py-2.5">
                <span data-testid="roster-selected-count" className="font-pa-body text-sm text-pa-grey-04">
                  <span className="font-pa-mono font-bold">{selectedPersonIds.length}</span> selected for mass
                  adjustment
                </span>
                <button
                  type="button"
                  data-testid="roster-select-all"
                  onClick={() => {
                    const ids = roster.map((p) => p.id)
                    const merged = new Set([...selectedPersonIds, ...ids])
                    setSelectedPersonIds(
                      rosterSelectedCount === roster.length
                        ? selectedPersonIds.filter((id) => !ids.includes(id))
                        : [...merged],
                    )
                  }}
                  className="rounded-pa-chip border border-pa-grey-02 px-2.5 py-1 font-pa-body text-xs font-semibold text-pa-grey-04 hover:bg-pa-grey-wash"
                >
                  {rosterSelectedCount === roster.length && roster.length > 0
                    ? 'Clear this team'
                    : 'Select all shown'}
                </button>
                {selectedPersonIds.length > 0 && (
                  <Link
                    to="/system1/mass-adjustment"
                    data-testid="roster-to-mass-adjust"
                    className="ml-auto rounded-pa-chip bg-pa-aqua-05 px-3 py-1.5 font-pa-body text-xs font-semibold text-pa-white hover:bg-pa-aqua-04"
                  >
                    Mass adjust selected →
                  </Link>
                )}
              </div>

              {roster.length === 0 ? (
                <p
                  data-testid="roster-empty"
                  className="rounded-pa-card border border-pa-grey-01 bg-pa-white p-6 text-center font-pa-body text-sm text-pa-grey-03"
                >
                  Nobody on this team matches “{search}”.
                </p>
              ) : (
                <div
                  data-testid="roster-grid"
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                >
                  {roster.map((person) => {
                    const target = targets[person.id]
                    return (
                      <PersonCard
                        key={person.id}
                        person={person}
                        status={target?.status}
                        target={target ? finalTargetFor(target) : 0}
                        selected={selectedPersonIds.includes(person.id)}
                        onToggle={() => togglePersonSelected(person.id)}
                        onView={() => navigate(`/system1/person/${person.id}`)}
                        onNotes={() => navigate(`/system1/override/${person.id}#notes`)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
