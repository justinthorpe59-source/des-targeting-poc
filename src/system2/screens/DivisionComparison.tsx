import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSystem2Store } from '../../store/system2Store'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses } from '../engine/riskStatus'
import { computeGoals } from '../engine/goals'
import { round1, statusBadgeClass, statusFill } from '../riskDisplay'
import { ScreenHeading } from '../../components/searchlight/ScreenHeading'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchScatter } from '../../components/searchlight/SketchIllustrations'
import { HBarChart } from '../../components/searchlight/HBarChart'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'

/**
 * S2-M5: coverage/forecast/confidence/status side by side across divisions.
 * Reads the same aggregate()/computeRiskStatuses() output ScreenB has been
 * exercising since S2-M2/M3 — no new calculation added. Searchlight design
 * pass added the loader, scatter motif and a token-styled forecast bar
 * chart (standard chart, not a custom viz); the table logic is unchanged.
 *
 * "Coverage" here follows the risk engine's own no-apportioning rule
 * (riskStatus.ts): a division's goal is independently computed from its own
 * prior-year revenue (goals.ts), never apportioned from the DES-wide goal.
 * Coverage = allocated target / that own goal — no longer ~100% by
 * construction now that goal is a real, independent figure.
 *
 * Acceptance signal: every division in the imported snapshot appears, no
 * omissions. Satisfied by iterating rollups.byDivision directly.
 *
 * Consolidation: absorbs the former TeamDrillDown screen (S2-M6) as an
 * expand-in-place interaction — clicking a division reveals its teams as a
 * nested row at the same level of detail, rather than navigating away. The
 * locked no-apportioning rule is unchanged: each team compares its own
 * expected achievement to its own goal (prior-year revenue x 1.1, computed
 * independently per team by goals.ts), never a slice of the DES-wide figure.
 *
 * Teams keep their DES-WIDE rank by absolute gap (data-rank), computed
 * across every team before nesting, so S2-M6's "ranked by absolute gap
 * contribution" signal still holds even though they now render grouped
 * under their division.
 */
export function DivisionComparison() {
  const records = useSystem2Store((state) => state.records)
  const rollups = useMemo(() => aggregate(records), [records])
  const goals = useMemo(() => computeGoals(rollups), [rollups])
  const riskStatuses = useMemo(() => computeRiskStatuses(records, rollups, goals), [records, rollups, goals])
  const loading = useInitialLoad(records.length > 0)
  const [expanded, setExpanded] = useState<string | null>(null)

  if (records.length === 0) {
    return (
      <section className="space-y-4">
        <ScreenHeading title="Division comparison">
          Coverage, forecast, confidence and status side by side across DES&apos;s divisions.
        </ScreenHeading>
        <div className="rounded-lg border border-pa-grey-01 bg-pa-white p-4 font-pa-body text-sm text-pa-grey-03">
          No snapshot imported yet.{' '}
          <Link to="/system2/executive-summary" className="font-medium text-pa-aqua-05 underline">
            Import from System 1
          </Link>{' '}
          on Executive summary first.
        </div>
      </section>
    )
  }

  // Every team, ranked DES-wide by absolute gap — the former Team drill-down
  // screen's ordering, computed once and preserved through the nesting.
  const rankedTeams = [...rollups.byTeam.entries()]
    .map(([teamKey, rollup]) => {
      const risk = riskStatuses.byTeam.get(teamKey)!
      const goal = goals.byTeam.get(teamKey) ?? rollup.target
      return { teamKey, rollup, risk, goal, gap: goal - rollup.expectedAchievement }
    })
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .map((row, index) => ({ ...row, rank: index + 1 }))

  const divisionRows = [...rollups.byDivision.entries()].map(([division, rollup]) => {
    const risk = riskStatuses.byDivision.get(division)!
    const goal = goals.byDivision.get(division) ?? 0
    const coverage = goal > 0 ? (rollup.target / goal) * 100 : 0
    return { division, rollup, risk, coverage, goal }
  })

  const teamChartRows = rankedTeams.map(({ teamKey, gap, risk }) => ({
    key: teamKey,
    label: teamKey.replace('::', ' / '),
    value: gap,
    display: `${gap >= 0 ? '−' : '+'}£${round1(Math.abs(gap))}k`,
    fill: statusFill(risk.status),
  }))

  const chartRows = divisionRows.map(({ division, risk }) => ({
    key: division,
    label: division,
    value: risk.forecastRatio * 100,
    display: `${round1(risk.forecastRatio * 100)}%`,
    fill: statusFill(risk.status),
  }))

  return (
    <section className="relative space-y-6">
      <SketchScatter className="pointer-events-none absolute right-0 top-8 -z-10 h-[360px] w-[560px] max-w-none opacity-[0.06]" />

      <ScreenHeading title="Division comparison">
        Coverage, forecast, confidence and status side by side across DES&apos;s divisions. Each
        division&apos;s goal is its own prior year revenue + 10%, independent of the others.
      </ScreenHeading>

      {loading ? (
        <SearchlightLoader />
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-6">
          <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
            <h2 className="mb-3 font-pa-display text-sm font-semibold text-pa-grey-04">Forecast by division</h2>
            <HBarChart rows={chartRows} />
          </div>

          <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
            <h2 className="mb-3 font-pa-display text-sm font-semibold text-pa-grey-04">
              Gap contribution by team — ranked DES-wide
            </h2>
            <HBarChart rows={teamChartRows} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-pa-grey-01 bg-pa-white">
            <table className="min-w-full divide-y divide-pa-grey-01 font-pa-body text-sm">
              <thead className="bg-pa-grey-wash text-left text-xs font-medium uppercase tracking-wide text-pa-grey-03">
                <tr>
                  <th className="px-3 py-2">Division</th>
                  <th className="px-3 py-2 text-right">Headcount</th>
                  <th className="px-3 py-2 text-right">Target</th>
                  <th className="px-3 py-2 text-right">Goal</th>
                  <th className="px-3 py-2 text-right">Coverage</th>
                  <th className="px-3 py-2 text-right">Forecast</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody data-testid="s2-division-comparison-rows">
                {divisionRows.map(({ division, rollup, risk, coverage, goal }) => [
                  <tr
                    key={division}
                    data-testid="s2-division-comparison-row"
                    data-division={division}
                    data-expanded={expanded === division ? 'true' : 'false'}
                    onClick={() => setExpanded((cur) => (cur === division ? null : division))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpanded((cur) => (cur === division ? null : division))
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-expanded={expanded === division}
                    className="cursor-pointer border-t border-pa-grey-01 hover:bg-pa-grey-wash focus:bg-pa-grey-wash focus:outline-none"
                  >
                    <td className="px-3 py-2 font-medium text-pa-grey-04">
                      <span
                        data-testid="s2-division-expand-caret"
                        aria-hidden="true"
                        className="mr-1.5 inline-block font-pa-mono text-xs text-pa-grey-03"
                      >
                        {expanded === division ? '▾' : '▸'}
                      </span>
                      {division}</td>
                    <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-03">{rollup.headcount}</td>
                    <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">£{round1(rollup.target)}k</td>
                    <td data-testid="s2-division-comparison-goal" className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">
                      £{round1(goal)}k
                    </td>
                    <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">{round1(coverage)}%</td>
                    <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">
                      {round1(risk.forecastRatio * 100)}%
                    </td>
                    <td className="px-3 py-2 text-pa-grey-03">
                      <span className="font-pa-mono">{risk.confidence}</span>
                      <span className="ml-1 text-xs text-pa-grey-02">(simulated)</span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        data-testid="s2-division-comparison-status"
                        data-status={risk.status}
                        className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(risk.status)}`}
                      >
                        {risk.status}
                      </span>
                      {risk.concentrationFlagged && (
                        <span className="ml-1 text-xs text-pa-apricot-04">concentration flagged</span>
                      )}
                    </td>
                  </tr>,
                  expanded === division ? (
                    <tr key={`${division}-teams`} data-testid="s2-division-expansion" data-division={division}>
                      <td colSpan={8} className="bg-pa-grey-wash px-3 py-3">
                        <div className="mb-2 font-pa-body text-xs font-medium uppercase tracking-wide text-pa-grey-03">
                          Teams in {division} — rank is DES-wide by absolute gap
                        </div>
                        <div data-testid="s2-team-drilldown-rows" className="grid gap-2 sm:grid-cols-2">
                          {rankedTeams
                            .filter((t) => t.teamKey.startsWith(`${division}::`))
                            .map(({ teamKey, rollup: teamRollup, risk: teamRisk, goal: teamGoal, gap, rank }) => (
                              <div
                                key={teamKey}
                                data-testid="s2-team-drilldown-row"
                                data-team-key={teamKey}
                                data-rank={rank}
                                className="rounded-lg border border-pa-grey-01 bg-pa-white p-3"
                              >
                                <div className="flex items-baseline justify-between">
                                  <span className="font-pa-body text-sm font-medium text-pa-grey-04">
                                    <span className="mr-1.5 font-pa-mono text-xs text-pa-grey-03">#{rank}</span>
                                    {teamKey.replace('::', ' / ')}
                                  </span>
                                  <span
                                    data-testid="s2-team-drilldown-status"
                                    data-status={teamRisk.status}
                                    className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(teamRisk.status)}`}
                                  >
                                    {teamRisk.status}
                                  </span>
                                </div>
                                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-pa-body text-xs text-pa-grey-03">
                                  <div className="flex justify-between">
                                    <dt>Headcount</dt>
                                    <dd className="font-pa-mono tabular-nums text-pa-grey-04">{teamRollup.headcount}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt>Target</dt>
                                    <dd className="font-pa-mono tabular-nums text-pa-grey-04">£{round1(teamRollup.target)}k</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt>Goal</dt>
                                    <dd data-testid="s2-team-drilldown-goal" className="font-pa-mono tabular-nums text-pa-grey-04">
                                      £{round1(teamGoal)}k
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt>Expected</dt>
                                    <dd className="font-pa-mono tabular-nums text-pa-grey-04">
                                      £{round1(teamRollup.expectedAchievement)}k
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt>Gap</dt>
                                    <dd data-testid="s2-team-drilldown-gap" className="font-pa-mono tabular-nums text-pa-grey-04">
                                      {gap >= 0 ? '−' : '+'}£{round1(Math.abs(gap))}k
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt>Confidence</dt>
                                    <dd className="font-pa-mono text-pa-grey-04">
                                      {teamRisk.confidence} <span className="text-pa-grey-02">(simulated)</span>
                                    </dd>
                                  </div>
                                </dl>
                                {teamRisk.concentrationFlagged && (
                                  <div className="mt-1 font-pa-body text-xs text-pa-apricot-04">concentration flagged</div>
                                )}
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ])}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
