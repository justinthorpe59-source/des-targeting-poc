import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSystem2Store } from '../../store/system2Store'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses, type RiskStatus } from '../engine/riskStatus'
import { computeGoals } from '../engine/goals'
import {statusBadgeClass} from '../riskDisplay'
import { RiskExceptionsSection } from '../components/RiskExceptionsSection'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchScatter } from '../../components/searchlight/SketchIllustrations'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'
import { formatMoney, formatPercent } from '../../shared/format'
import { SectionHeading } from '../../components/searchlight/Section'

/**
 * S2-M5/M6: coverage, forecast, confidence and status side by side across
 * divisions, with the former Team Drill-down screen absorbed as an
 * expand-in-place interaction.
 *
 * Rebuilt 27 Sept 2026 to the visual spec's §7. It was previously two bar
 * charts above a dense 8-column table; the spec asks for division cards at
 * the weight of Executive Summary's stat tiles, carrying the same
 * status-coloured gradient treatment as that screen's hero. Both charts are
 * gone — each restated a figure now printed on the card it sat above.
 *
 * Two places the spec is demonstrably wrong about this project's own data
 * are corrected here rather than followed (see the build notes): it lists
 * the division cards as "Boston / Ireland / London / GITC", which are the
 * four *locations*, and asks each card to carry a "location tag", which a
 * division cannot have — every division spans all four.
 *
 * Locked rules that survive the rebuild untouched:
 *   - No apportioning. Each division and team compares its own expected
 *     achievement to its own independently-computed goal (prior-year
 *     revenue x 1.1), never a slice of the DES-wide figure.
 *   - Teams keep their DES-WIDE rank by absolute gap, computed across every
 *     team before nesting, so S2-M6's ranking signal still holds even
 *     though they render grouped under their division.
 */

/** Same status->gradient mapping as Executive Summary's hero: the fill
    itself carries the risk status, saturated at the left and fading out. */
const STATUS_GRADIENT: Record<RiskStatus, string> = {
  'On track': 'var(--color-pa-lime-03), var(--color-pa-lime-01)',
  'At risk': 'var(--color-pa-apricot-03), var(--color-pa-apricot-01)',
  'Off track': 'var(--color-pa-rose-04), var(--color-pa-rose-01)',
  Infeasible: 'var(--color-pa-ingenuity-red), var(--color-pa-rose-01)',
}

/** The forecast ratio as a proportional bar — width is the ratio, hue is
    the status, the same one-mark-two-readings device as the hero. */
function ForecastBar({ ratio, status, testId }: { ratio: number; status: RiskStatus; testId?: string }) {
  const pct = ratio * 100
  return (
    <div>
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--color-pa-white)' }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundImage: `linear-gradient(to right, ${STATUS_GRADIENT[status]})`,
          }}
        />
      </div>
      <p className="mt-2 font-pa-display text-3xl font-medium leading-none tracking-tight text-pa-grey-04">
        <span data-testid={testId}>{formatPercent(pct)}</span>
      </p>
      <p className="mt-1 font-pa-body text-[11px] uppercase tracking-[0.1em] text-pa-grey-03">Forecast</p>
    </div>
  )
}

function MetricPair({
  label,
  value,
  sub,
  testId,
}: {
  label: string
  value: string
  sub?: string
  testId?: string
}) {
  return (
    <div>
      <p className="font-pa-body text-[11px] uppercase tracking-[0.1em] text-pa-grey-03">{label}</p>
      <p data-testid={testId} className="mt-1 font-pa-mono text-sm font-bold tabular-nums text-pa-grey-04">
        {value}
        {sub && <span className="ml-1 font-pa-body text-[11px] font-normal text-pa-grey-02">{sub}</span>}
      </p>
    </div>
  )
}

export function DivisionComparison() {
  const records = useSystem2Store((state) => state.records)
  const rollups = useMemo(() => aggregate(records), [records])
  const goals = useMemo(() => computeGoals(rollups), [rollups])
  const riskStatuses = useMemo(() => computeRiskStatuses(records, rollups, goals), [records, rollups, goals])
  const loading = useInitialLoad(records.length > 0)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Every team, ranked DES-wide by absolute gap — the former Team
  // Drill-down screen's ordering, computed once, before any nesting.
  const rankedTeams = useMemo(
    () =>
      [...rollups.byTeam.entries()]
        .map(([teamKey, rollup]) => {
          const risk = riskStatuses.byTeam.get(teamKey)!
          const goal = goals.byTeam.get(teamKey) ?? rollup.target
          return { teamKey, rollup, risk, goal, gap: goal - rollup.expectedAchievement }
        })
        .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
        .map((row, index) => ({ ...row, rank: index + 1 })),
    [rollups, goals, riskStatuses],
  )

  const divisionRows = useMemo(
    () =>
      [...rollups.byDivision.entries()].map(([division, rollup]) => {
        const risk = riskStatuses.byDivision.get(division)!
        const goal = goals.byDivision.get(division) ?? 0
        return {
          division,
          rollup,
          risk,
          goal,
          coverage: goal > 0 ? (rollup.target / goal) * 100 : 0,
          teamCount: rankedTeams.filter((t) => t.teamKey.startsWith(`${division}::`)).length,
        }
      }),
    [rollups, goals, riskStatuses, rankedTeams],
  )

  if (records.length === 0) {
    return (
      <section className="space-y-4">
        <header>
          <SectionHeading first="Design, Engineering &amp; Science" second="Division comparison" />
        </header>
        <div className="rounded-pa-card bg-pa-grey-01 p-6 font-pa-body text-sm text-pa-grey-03">
          No snapshot imported yet.{' '}
          <Link to="/system2/executive-summary" className="font-semibold text-pa-grey-04 underline">
            Import from System 1
          </Link>{' '}
          on Executive summary first.
        </div>
      </section>
    )
  }

  const expandedTeams = expanded
    ? rankedTeams.filter((t) => t.teamKey.startsWith(`${expanded}::`))
    : []

  return (
    <section className="relative">
      <SketchScatter className="pointer-events-none absolute right-0 top-8 -z-10 h-[360px] w-[560px] max-w-none opacity-[0.06]" />

      {/* Benchmark heading, matching Executive Summary — the two
          sponsor-facing screens stay in step with each other and with the
          rest of the app. */}
      <header>
        <SectionHeading first="Design, Engineering &amp; Science" second="Division comparison" />
        <p className="mt-4 max-w-xl font-pa-body text-sm text-pa-grey-03">
          Each division&apos;s goal is its own prior year revenue + 10%, never a slice of the DES-wide figure.
        </p>
      </header>

      {loading ? (
        <div className="py-24">
          <SearchlightLoader />
        </div>
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-10 pb-16 pt-16">
          <div data-testid="s2-division-comparison-rows" className="grid gap-5 lg:grid-cols-3">
            {divisionRows.map(({ division, rollup, risk, goal, coverage, teamCount }) => {
              const isOpen = expanded === division
              return (
                <button
                  key={division}
                  type="button"
                  data-testid="s2-division-comparison-row"
                  data-division={division}
                  data-expanded={isOpen ? 'true' : 'false'}
                  aria-expanded={isOpen}
                  onClick={() => setExpanded((cur) => (cur === division ? null : division))}
                  /* flex-col/items-stretch is load-bearing, not cosmetic: a
                     bare <button> centres its content box, so the one card
                     carrying an extra "Concentration flagged" line rode 12px
                     higher than its neighbours inside an identically-sized
                     card. Top-aligning the content keeps the row level. */
                  className="flex flex-col items-stretch rounded-pa-card px-6 py-5 text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-grey-03"
                  style={{
                    background: 'var(--color-pa-white)',
                    boxShadow: isOpen ? 'var(--shadow-pa-card-raised)' : 'var(--shadow-pa-card)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-pa-body text-sm font-semibold text-pa-grey-04">{division}.</p>
                    <span
                      data-testid="s2-division-comparison-status"
                      data-status={risk.status}
                      className={`shrink-0 rounded-pa-chip px-2.5 py-1 font-pa-body text-[11px] font-semibold ${statusBadgeClass(risk.status)}`}
                    >
                      {risk.status}
                    </span>
                  </div>

                  <div className="mt-5">
                    <ForecastBar ratio={risk.forecastRatio} status={risk.status} />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <MetricPair label="Coverage" value={formatPercent(coverage)} />
                    <MetricPair label="Confidence" value={risk.confidence} sub="(simulated)" />
                    <MetricPair
                      label="Goal"
                      value={formatMoney(goal)}
                      testId="s2-division-comparison-goal"
                    />
                    <MetricPair label="Headcount" value={`${rollup.headcount}`} />
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-pa-grey-02/40 pt-3">
                    <span className="font-pa-body text-[11px] uppercase tracking-[0.1em] text-pa-grey-03">
                      {teamCount} teams
                    </span>
                    <span className="flex items-center gap-1.5 font-pa-body text-xs font-semibold text-pa-grey-04">
                      {isOpen ? 'Hide teams' : 'Show teams'}
                      <span
                        data-testid="s2-division-expand-caret"
                        aria-hidden="true"
                        className="font-pa-mono text-xs"
                      >
                        {isOpen ? '▾' : '▸'}
                      </span>
                    </span>
                  </div>
                  {risk.concentrationFlagged && (
                    <p className="mt-2 font-pa-body text-[11px] text-pa-apricot-04">Concentration flagged</p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Expansion sits full-width beneath the whole row rather than
              inside one grid cell — a three-column grid cannot nest a second
              row under a single card without either collapsing the grid or
              squeezing the team cards into a third of the width. */}
          {expanded && (
            <div data-testid="s2-division-expansion" data-division={expanded} className="space-y-5">
              <p className="font-pa-body text-[11px] uppercase tracking-[0.1em] text-pa-grey-03">
                Teams in {expanded} — rank is DES-wide by absolute gap
              </p>

              <div data-testid="s2-team-drilldown-rows" className="grid gap-5 lg:grid-cols-2">
                {expandedTeams.map(({ teamKey, rollup, risk, goal, gap, rank }) => (
                  <div
                    key={teamKey}
                    data-testid="s2-team-drilldown-row"
                    data-team-key={teamKey}
                    data-rank={rank}
                    className="rounded-pa-card bg-pa-white px-6 py-5 shadow-pa-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-pa-body text-sm font-semibold text-pa-grey-04">
                        <span className="mr-2 font-pa-mono text-xs font-normal text-pa-grey-03">#{rank}</span>
                        {teamKey.replace('::', ' / ')}.
                      </p>
                      <span
                        data-testid="s2-team-drilldown-status"
                        data-status={risk.status}
                        className={`shrink-0 rounded-pa-chip px-2.5 py-1 font-pa-body text-[11px] font-semibold ${statusBadgeClass(risk.status)}`}
                      >
                        {risk.status}
                      </span>
                    </div>

                    {/* Same trio, same visual weight as the division card. */}
                    <div className="mt-5">
                      <ForecastBar ratio={risk.forecastRatio} status={risk.status} />
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <MetricPair
                        label="Coverage"
                        value={formatPercent(goal > 0 ? (rollup.target / goal) * 100 : 0)}
                      />
                      <MetricPair label="Confidence" value={risk.confidence} sub="(simulated)" />
                      <MetricPair label="Expected" value={formatMoney(rollup.expectedAchievement)} />
                      <MetricPair label="Headcount" value={`${rollup.headcount}`} />
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-pa-grey-02/40 pt-3">
                      <span className="font-pa-body text-[11px] uppercase tracking-[0.1em] text-pa-grey-03">
                        Goal{' '}
                        <span data-testid="s2-team-drilldown-goal" className="font-pa-mono normal-case text-pa-grey-04">
                          {formatMoney(goal)}
                        </span>
                      </span>
                      <span className="font-pa-body text-[11px] uppercase tracking-[0.1em] text-pa-grey-03">
                        Gap{' '}
                        <span data-testid="s2-team-drilldown-gap" className="font-pa-mono normal-case text-pa-grey-04">
                          {gap >= 0 ? '−' : '+'}{formatMoney(Math.abs(gap))}
                        </span>
                      </span>
                    </div>
                    {risk.concentrationFlagged && (
                      <p className="mt-2 font-pa-body text-[11px] text-pa-apricot-04">Concentration flagged</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Risks, scoped to the expanded division when there is one —
              the same component Executive Summary renders unscoped. */}
          <RiskExceptionsSection scopeKey={expanded ?? undefined} />
        </div>
      )}
    </section>
  )
}
