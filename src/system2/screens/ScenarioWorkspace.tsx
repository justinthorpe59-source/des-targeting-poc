import { useMemo, useRef, useState } from 'react'
import type { Division } from '../../system1/data/types'
import { useSystem2Store } from '../../store/system2Store'
import { useScenarioStore } from '../../store/scenarioStore'
import { aggregate } from '../engine/aggregation'
import { computeGoals } from '../engine/goals'
import { computeRiskStatuses, type Confidence } from '../engine/riskStatus'
import { runScenario, type ScenarioLevers } from '../engine/scenario'
import { statusBadgeClass } from '../riskDisplay'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'
import { SectionHeading } from '../../components/searchlight/Section'
import { formatMoney, formatPercent } from '../../shared/format'

/**
 * S2-M7/M8 Scenario Workspace, rebuilt 27 Sept 2026 against the supplied
 * reference screenshot.
 *
 * This screen previously carried the "engineering console" register locked
 * in searchlight-visual-spec.md §8 (monospace bracketed labels, dotted grid,
 * dark terminal diff panel). That register is superseded for this screen by
 * explicit instruction: the reference's light card language is the design,
 * and it brings Scenario Workspace back in line with the rest of the app
 * rather than breaking away from it.
 *
 * Colour is not copied from the reference — it is mapped onto PA tokens.
 * The reference's black is Dark Blue (#00172d), the darkest token in the
 * palette; its card radius is --radius-pa-card (16px), already inside the
 * reference's 16-20px range. No hex is invented here.
 *
 * Structure the reference contributes: a row of white cards over a numbered
 * pagination strip, circular prev/next controls top-right of each section,
 * and a second horizontally-scrolling card row beneath.
 *
 * The data boundary is unchanged: records come from system2Store (the
 * imported Approved-only snapshot), never from System 1's live store, and
 * runScenario() never writes anything back.
 *
 * react-bits was checked for the card-row/pagination pattern per the
 * frontend-components skill. Its free tier is creative/animated widgets
 * (Stepper, Dock, Carousel-as-motion-toy); none is a selectable card row
 * with an external numbered indicator strip, so this is hand-built.
 */

/* The reference's four scenario examples. Two of them name groups that do
   not exist in this dataset, so they are bound to real ones here and
   flagged rather than invented:
     "Division B" -> Engineering (the second of Design/Engineering/Science)
     "a cohort"   -> Design

   Design is not an arbitrary pick for the confidence lever. Confidence is
   simulated deterministically per group, and Engineering and Science both
   already sit at Low — pointing the lever at either produced a card that
   read "Low -> Low" and changed nothing. Design (Medium) is the only
   division the lever can actually move. */
const CAPACITY_DIP_DIVISION: Division = 'Engineering'
const CONFIDENCE_DIVISION: Division = 'Design'
const CAPACITY_DIP_MULTIPLIER = 0.9
const POPULATION_STRETCH_PERCENT = 10
const GOAL_RAISE_PERCENT = 5

type IconName = 'bar' | 'dip' | 'stretch' | 'confidence'

/** Simple stroke icons for the card badges — the reference's badge holds a
    single-weight line glyph, so these are drawn rather than pulled from an
    icon set with its own visual voice. */
function Icon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'bar':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 16h14" />
          <path d="M6 16V9" />
          <path d="M10 16V6" />
          <path d="M14 16v-4" />
          <path d="M12.5 4.5 14 3l1.5 1.5" />
        </svg>
      )
    case 'dip':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 6l4 5 3-2 4 6" />
          <path d="M17 15h-3.5" />
          <path d="M15.5 17l-2-2 2-2" />
        </svg>
      )
    case 'stretch':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 10h14" />
          <path d="M5.5 7.5 3 10l2.5 2.5" />
          <path d="M14.5 7.5 17 10l-2.5 2.5" />
          <path d="M10 4v12" />
        </svg>
      )
    case 'confidence':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M10 3l6 2.5v4c0 3.5-2.4 6.3-6 7.5-3.6-1.2-6-4-6-7.5v-4L10 3z" />
          <path d="M7.5 10l1.8 1.8L13 8" />
        </svg>
      )
  }
}

interface Preset {
  id: string
  index: string
  title: string
  blurb: string
  icon: IconName
  levers: ScenarioLevers
}

function presetsFor(baselineGoal: number): Preset[] {
  return [
    {
      id: 'raise-the-bar',
      index: '01',
      title: 'Raise the bar',
      blurb: `Lift the DES-wide organisational goal by ${GOAL_RAISE_PERCENT}% and see whether the forecast still reaches it.`,
      icon: 'bar',
      levers: { goal: Math.round(baselineGoal * (1 + GOAL_RAISE_PERCENT / 100)) },
    },
    {
      id: 'capacity-dip',
      index: '02',
      title: `${CAPACITY_DIP_DIVISION} capacity dip`,
      blurb: `Drop capacity utilisation across ${CAPACITY_DIP_DIVISION} by ${Math.round((1 - CAPACITY_DIP_MULTIPLIER) * 100)}% and watch it cascade into the rollups.`,
      icon: 'dip',
      levers: {
        capacityChange: {
          scope: { level: 'division', division: CAPACITY_DIP_DIVISION },
          multiplier: CAPACITY_DIP_MULTIPLIER,
        },
      },
    },
    {
      id: 'team-stretch',
      index: '03',
      title: 'Team-wide stretch',
      /* The locked lever is population-wide and unfiltered — see
         scenario.ts, lever 3. It is described honestly here rather than
         claiming a team scope the engine does not implement. */
      blurb: `Apply a +${POPULATION_STRETCH_PERCENT}% target uplift across every imported record, the way a mass adjustment would.`,
      icon: 'stretch',
      levers: { populationAdjustmentPercent: POPULATION_STRETCH_PERCENT },
    },
    {
      id: 'confidence-check',
      index: '04',
      title: 'Confidence check',
      blurb: `Force ${CONFIDENCE_DIVISION}'s confidence down to Low and see what that alone does to its risk status.`,
      icon: 'confidence',
      levers: {
        groupOverride: {
          target: { level: 'division', division: CONFIDENCE_DIVISION },
          confidence: 'Low',
        },
      },
    },
  ]
}

interface DiffRow {
  label: string
  before: string
  after: string
}

type OutcomeScope =
  | { kind: 'desWide'; label: string }
  | { kind: 'division'; division: Division; label: string }
  | { kind: 'team'; key: string; label: string }

/**
 * Which group's numbers the outcome panel reports.
 *
 * Lever 4 never cascades to parent rollups, and that is locked behaviour —
 * so a division-scoped confidence override is invisible at DES-wide. Fixing
 * the panel to DES-wide made those scenarios read as doing nothing at all.
 * The panel follows the lever's own scope instead, and says which group it
 * is showing.
 */
function scopeFor(levers: ScenarioLevers): OutcomeScope {
  const target = levers.groupOverride?.target
  if (target) {
    if (target.level === 'division') return { kind: 'division', division: target.division!, label: target.division! }
    if (target.level === 'team')
      return { kind: 'team', key: `${target.division}::${target.team}`, label: `${target.division} / ${target.team}` }
  }
  const scope = levers.capacityChange?.scope
  if (scope) {
    if (scope.level === 'division') return { kind: 'division', division: scope.division, label: scope.division }
    return { kind: 'team', key: `${scope.division}::${scope.team}`, label: `${scope.division} / ${scope.team}` }
  }
  return { kind: 'desWide', label: 'DES-wide' }
}

function readScope(
  scope: OutcomeScope,
  result: Pick<ReturnType<typeof runScenario>, 'aggregation' | 'goals' | 'riskStatuses'>,
  goalOverride?: number,
) {
  if (scope.kind === 'desWide') {
    return {
      rollup: result.aggregation.desWide,
      goal: goalOverride ?? result.goals.desWide,
      risk: result.riskStatuses.desWide,
    }
  }
  if (scope.kind === 'division') {
    return {
      rollup: result.aggregation.byDivision.get(scope.division),
      goal: result.goals.byDivision.get(scope.division),
      risk: result.riskStatuses.byDivision.get(scope.division),
    }
  }
  return {
    rollup: result.aggregation.byTeam.get(scope.key),
    goal: result.goals.byTeam.get(scope.key),
    risk: result.riskStatuses.byTeam.get(scope.key),
  }
}

/** Circular prev/next pair — filled Dark Blue for forward, outlined white
    for back, exactly as the reference pairs them. */
function NavArrows({
  onPrev,
  onNext,
  testIdPrefix,
  label,
}: {
  onPrev: () => void
  onNext: () => void
  testIdPrefix: string
  label: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <button
        type="button"
        data-testid={`${testIdPrefix}-prev`}
        onClick={onPrev}
        aria-label={`Previous ${label}`}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-pa-grey-02 bg-pa-white text-pa-grey-04 transition-colors hover:bg-pa-grey-01 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-grey-03"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 10H4" />
          <path d="M8.5 5.5 4 10l4.5 4.5" />
        </svg>
      </button>
      <button
        type="button"
        data-testid={`${testIdPrefix}-next`}
        onClick={onNext}
        aria-label={`Next ${label}`}
        className="flex h-12 w-12 items-center justify-center rounded-full transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-grey-03"
        /* Accent + dark ink, never white ink: white on the accent measures
           2.50:1 and fails AA. */
        style={{ background: 'var(--color-pa-accent)', color: 'var(--color-pa-accent-ink)' }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 10h12" />
          <path d="M11.5 5.5 16 10l-4.5 4.5" />
        </svg>
      </button>
    </div>
  )
}

export function ScenarioWorkspace() {
  const records = useSystem2Store((state) => state.records)
  const savedScenarios = useScenarioStore((state) => state.scenarios)
  const saveScenario = useScenarioStore((state) => state.saveScenario)

  const baselineAggregation = useMemo(() => aggregate(records), [records])
  const baselineGoals = useMemo(() => computeGoals(baselineAggregation), [baselineAggregation])
  const baselineRisk = useMemo(
    () => computeRiskStatuses(records, baselineAggregation, baselineGoals),
    [records, baselineAggregation, baselineGoals],
  )

  const presets = useMemo(() => presetsFor(baselineGoals.desWide), [baselineGoals.desWide])

  /* One selection drives the diff panel, whichever row it came from.
     'baseline' is the default comparison state — it is selectable in the
     saved row but is never one of the four numbered cards. */
  const [selectedId, setSelectedId] = useState<string>(presets[0].id)
  const [scenarioName, setScenarioName] = useState('')
  const carouselRef = useRef<HTMLDivElement>(null)

  const loading = useInitialLoad(records.length > 0)

  const selectedPreset = presets.find((p) => p.id === selectedId)
  const selectedSaved = savedScenarios.find((s) => s.id === selectedId)
  /* Memoised: the `?? {}` fallback would otherwise be a fresh object every
     render, so runScenario() below would never hit its cache. */
  const selectedLevers = useMemo<ScenarioLevers>(
    () => selectedPreset?.levers ?? selectedSaved?.levers ?? {},
    [selectedPreset, selectedSaved],
  )
  const selectedLabel = selectedPreset?.title ?? selectedSaved?.name ?? 'Baseline'

  const scenario = useMemo(() => runScenario(records, selectedLevers), [records, selectedLevers])

  const configRows = useMemo<DiffRow[]>(() => {
    const rows: DiffRow[] = []
    const l = selectedLevers

    if (l.goal !== undefined) {
      rows.push({ label: 'Organisational goal', before: formatMoney(baselineGoals.desWide), after: formatMoney(l.goal) })
    }
    if (l.capacityChange) {
      const { scope, multiplier } = l.capacityChange
      const where = scope.level === 'division' ? scope.division : `${scope.division} / ${scope.team}`
      rows.push({ label: `Capacity · ${where}`, before: '×1.00', after: `×${multiplier.toFixed(2)}` })
    }
    if (l.populationAdjustmentPercent) {
      rows.push({
        label: 'Target uplift · every record',
        before: '+0%',
        after: `${l.populationAdjustmentPercent > 0 ? '+' : ''}${l.populationAdjustmentPercent}%`,
      })
    }
    if (l.groupOverride) {
      const { target, expectedAchievement, confidence } = l.groupOverride
      const where =
        target.level === 'desWide'
          ? 'DES-wide'
          : target.level === 'division'
            ? target.division!
            : `${target.division} / ${target.team}`
      if (confidence) {
        const before: Confidence | undefined =
          target.level === 'desWide'
            ? baselineRisk.desWide.confidence
            : target.level === 'division'
              ? baselineRisk.byDivision.get(target.division!)?.confidence
              : baselineRisk.byTeam.get(`${target.division}::${target.team}`)?.confidence
        rows.push({ label: `Confidence · ${where}`, before: before ?? '—', after: confidence })
      }
      if (expectedAchievement !== undefined) {
        rows.push({
          label: `Expected achievement · ${where}`,
          before: formatMoney(baselineAggregation.desWide.expectedAchievement),
          after: formatMoney(expectedAchievement),
        })
      }
    }
    return rows
  }, [selectedLevers, baselineGoals.desWide, baselineRisk, baselineAggregation])

  const scope = useMemo(() => scopeFor(selectedLevers), [selectedLevers])

  const before = useMemo(
    () => readScope(scope, { aggregation: baselineAggregation, goals: baselineGoals, riskStatuses: baselineRisk }),
    [scope, baselineAggregation, baselineGoals, baselineRisk],
  )
  const after = useMemo(() => readScope(scope, scenario, selectedLevers.goal), [scope, scenario, selectedLevers.goal])

  const outcomeRows = useMemo<DiffRow[]>(() => {
    if (!before.rollup || !after.rollup || before.goal === undefined || after.goal === undefined) return []
    return [
      {
        label: 'Expected achievement',
        before: formatMoney(before.rollup.expectedAchievement),
        after: formatMoney(after.rollup.expectedAchievement),
      },
      {
        label: 'Gap to goal',
        before: formatMoney(before.goal - before.rollup.expectedAchievement),
        after: formatMoney(after.goal - after.rollup.expectedAchievement),
      },
      {
        label: 'Confidence',
        before: before.risk?.confidence ?? '—',
        after: after.risk?.confidence ?? '—',
      },
      {
        label: 'Forecast ratio',
        before: formatPercent((before.risk?.forecastRatio ?? 0) * 100),
        after: formatPercent((after.risk?.forecastRatio ?? 0) * 100),
      },
    ]
  }, [before, after])

  const stepPreset = (delta: number) => {
    const currentIndex = presets.findIndex((p) => p.id === selectedId)
    // A saved/baseline selection has no place in the preset row; step from
    // the first card rather than nowhere.
    const from = currentIndex === -1 ? 0 : currentIndex
    const next = (from + delta + presets.length) % presets.length
    setSelectedId(presets[next].id)
  }

  const scrollCarousel = (delta: number) => {
    carouselRef.current?.scrollBy({ left: delta * 280, behavior: 'smooth' })
  }

  if (loading) return <SearchlightLoader />

  if (records.length === 0) {
    return (
      <section className="space-y-4">
        <SectionHeading first="Scenario workspace" second="Nothing imported yet" />
        <p className="max-w-xl font-pa-body text-sm text-pa-grey-03">
          Import an Approved-only snapshot from System 1 before testing a scenario against it.
        </p>
      </section>
    )
  }

  const savedCards = [
    { id: 'baseline', name: 'Baseline', meta: 'Untouched snapshot' },
    ...savedScenarios.map((s) => ({
      id: s.id,
      name: s.name,
      meta: new Date(s.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    })),
  ]

  return (
    <section className="space-y-20 pb-8">
      {/* ---------- Scenario options ---------- */}
      <div className="space-y-10">
        <SectionHeading
          first="Scenario workspace"
          second="Test before you commit"
          action={<NavArrows onPrev={() => stepPreset(-1)} onNext={() => stepPreset(1)} testIdPrefix="preset-nav" label="scenario" />}
        />

        <div data-testid="preset-cards" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {presets.map((preset) => {
            const active = preset.id === selectedId
            return (
              <button
                key={preset.id}
                type="button"
                data-testid="preset-card"
                data-preset-id={preset.id}
                data-active={active ? 'true' : 'false'}
                onClick={() => setSelectedId(preset.id)}
                className={`flex h-52 flex-col rounded-pa-card bg-pa-white p-6 text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-grey-03 ${
                  active
                    ? 'shadow-pa-card-raised'
                    : 'shadow-pa-card hover:shadow-pa-card-hover'
                }`}
              >
                <span className="font-pa-display text-xl font-semibold leading-snug text-pa-grey-04">
                  {preset.title}
                </span>
                <span className="mt-2 font-pa-body text-sm leading-snug text-pa-grey-03">{preset.blurb}</span>
                <span
                  aria-hidden="true"
                  className="mt-auto flex h-11 w-11 items-center justify-center rounded-pa-chip bg-pa-grey-01 text-pa-grey-04"
                >
                  <Icon name={preset.icon} />
                </span>
              </button>
            )
          })}
        </div>

        {/* Numbered strip on a full-width rule, as the reference draws it. */}
        <div className="relative flex items-center gap-3">
          <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-pa-grey-01" />
          {presets.map((preset) => {
            const active = preset.id === selectedId
            return (
              <button
                key={preset.id}
                type="button"
                data-testid="preset-pagination"
                data-preset-id={preset.id}
                data-active={active ? 'true' : 'false'}
                onClick={() => setSelectedId(preset.id)}
                aria-label={`Scenario ${preset.index}: ${preset.title}`}
                className={`relative rounded-pa-chip px-5 py-2.5 font-pa-mono text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-grey-03 ${
                  active ? '' : 'border border-pa-grey-02 bg-pa-white text-pa-grey-04 hover:bg-pa-grey-01'
                }`}
                style={
                  active
                    ? { background: 'var(--color-pa-accent)', color: 'var(--color-pa-accent-ink)' }
                    : undefined
                }
              >
                {preset.index}
              </button>
            )
          })}
        </div>
      </div>

      {/* ---------- Saved scenarios ---------- */}
      <div className="space-y-8">
        <SectionHeading
          first="Saved scenarios"
          second="Baseline and the ones you save"
          action={<NavArrows onPrev={() => scrollCarousel(-1)} onNext={() => scrollCarousel(1)} testIdPrefix="saved-nav" label="saved scenario" />}
        />

        <div
          ref={carouselRef}
          data-testid="saved-carousel"
          className="flex snap-x gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {savedCards.map((card) => {
            const active = card.id === selectedId
            return (
              <button
                key={card.id}
                type="button"
                data-testid="saved-card"
                data-scenario-id={card.id}
                data-active={active ? 'true' : 'false'}
                onClick={() => setSelectedId(card.id)}
                className={`flex h-36 w-64 shrink-0 snap-start flex-col justify-end rounded-pa-card bg-pa-white p-5 text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-grey-03 ${
                  active
                    ? 'shadow-pa-card-raised'
                    : 'shadow-pa-card hover:shadow-pa-card-hover'
                }`}
              >
                <span className="font-pa-body text-xs text-pa-grey-03">{card.meta}</span>
                <span className="mt-1 font-pa-display text-lg font-semibold leading-snug text-pa-grey-04">
                  {card.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Save is kept from S2-M8: without it the saved row can never hold
            anything but Baseline, and the "reopened later, shows the same
            result" signal would have nothing to run against. */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            data-testid="scenario-name-input"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder={`Name this scenario (${selectedLabel})`}
            className="w-72 rounded-pa-chip border border-pa-grey-02 bg-pa-white px-4 py-2.5 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none"
          />
          <button
            type="button"
            data-testid="scenario-save-button"
            disabled={scenarioName.trim().length === 0 || configRows.length === 0}
            onClick={() => {
              saveScenario(scenarioName.trim(), selectedLevers)
              setScenarioName('')
            }}
            className="rounded-pa-chip px-5 py-2.5 font-pa-body text-sm font-semibold transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--color-pa-accent)', color: 'var(--color-pa-accent-ink)' }}
          >
            Save scenario
          </button>
        </div>
      </div>

      {/* ---------- Diff panel ---------- */}
      <div
        data-testid="scenario-diff"
        data-selected-id={selectedId}
        className="rounded-pa-card bg-pa-white p-8 shadow-pa-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-pa-body text-xs font-bold uppercase tracking-[0.14em] text-pa-grey-03">
              Baseline → Scenario
            </p>
            <p data-testid="diff-title" className="mt-1 font-pa-display text-2xl font-semibold text-pa-grey-04">
              {selectedLabel}
            </p>
          </div>
          {after.risk && (
            <span
              data-testid="diff-status"
              data-scope={scope.label}
              className={`rounded-pa-chip px-3 py-1.5 font-pa-body text-xs font-semibold ${statusBadgeClass(after.risk.status)}`}
            >
              {scope.label} · {after.risk.status}
            </span>
          )}
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <div>
            <p className="font-pa-body text-xs font-bold uppercase tracking-[0.14em] text-pa-grey-03">
              What changes
            </p>
            {configRows.length === 0 ? (
              <p data-testid="diff-no-levers" className="mt-4 font-pa-body text-sm text-pa-grey-03">
                No levers applied — this is the untouched imported snapshot.
              </p>
            ) : (
              <dl data-testid="diff-config-rows" className="mt-4">
                {configRows.map((row) => (
                  <div
                    key={row.label}
                    data-testid="diff-config-row"
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-pa-grey-01 py-3 last:border-0"
                  >
                    <dt className="font-pa-body text-sm text-pa-grey-04">{row.label}</dt>
                    <dd className="font-pa-mono text-sm text-pa-grey-04">
                      <span className="text-pa-grey-03">{row.before}</span>
                      <span className="px-2 text-pa-grey-02">→</span>
                      <span className="font-bold">{row.after}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div>
            <p className="font-pa-body text-xs font-bold uppercase tracking-[0.14em] text-pa-grey-03">
              What it does · {scope.label}
            </p>
            <dl data-testid="diff-outcome-rows" className="mt-4">
              {outcomeRows.map((row) => (
                <div
                  key={row.label}
                  data-testid="diff-outcome-row"
                  data-label={row.label}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-pa-grey-01 py-3 last:border-0"
                >
                  <dt className="font-pa-body text-sm text-pa-grey-04">{row.label}</dt>
                  <dd className="font-pa-mono text-sm text-pa-grey-04">
                    <span className="text-pa-grey-03">{row.before}</span>
                    <span className="px-2 text-pa-grey-02">→</span>
                    <span className="font-bold">{row.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
