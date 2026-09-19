import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSystem2Store } from '../../store/system2Store'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses } from '../engine/riskStatus'
import { round1, statusBadgeClass, statusFill } from '../riskDisplay'
import { ScreenHeading } from '../components/ScreenHeading'
import { SearchlightLoader } from '../components/SearchlightLoader'
import { SketchNetwork } from '../components/SketchIllustrations'
import { HBarChart } from '../components/HBarChart'
import { useInitialLoad } from '../components/useInitialLoad'

/**
 * S2-M6: teams ranked by contribution to the gap. Locked rule: this does
 * NOT apportion the DES-wide goal down to team level — each team compares
 * its own allocated target to its own expected achievement. Ranking is by
 * absolute gap. Searchlight design pass added the loader, network motif and
 * a token-styled gap bar chart (standard chart) that mirrors the ranking;
 * the table logic is unchanged.
 */
export function TeamDrillDown() {
  const records = useSystem2Store((state) => state.records)
  const rollups = useMemo(() => aggregate(records), [records])
  const riskStatuses = useMemo(() => computeRiskStatuses(records, rollups), [records, rollups])
  const loading = useInitialLoad(records.length > 0)

  if (records.length === 0) {
    return (
      <section className="space-y-4">
        <ScreenHeading title="Team drill-down">
          Teams ranked by their absolute contribution to the gap between target and expected
          achievement.
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

  const teamRows = [...rollups.byTeam.entries()]
    .map(([teamKey, rollup]) => {
      const risk = riskStatuses.byTeam.get(teamKey)!
      const gap = rollup.target - rollup.expectedAchievement
      return { teamKey, rollup, risk, gap }
    })
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))

  const chartRows = teamRows.map(({ teamKey, gap, risk }) => ({
    key: teamKey,
    label: teamKey.replace('::', ' / '),
    value: gap,
    display: `${gap >= 0 ? '−' : '+'}£${round1(Math.abs(gap))}k`,
    fill: statusFill(risk.status),
  }))

  return (
    <section className="relative space-y-6">
      <SketchNetwork className="pointer-events-none absolute right-2 top-6 -z-10 h-[380px] w-[380px] max-w-none opacity-[0.06]" />

      <ScreenHeading title="Team drill-down">
        Teams ranked by their absolute contribution to the gap between target and expected
        achievement — each team against its own target, not a slice of the DES-wide goal.
      </ScreenHeading>

      {loading ? (
        <SearchlightLoader />
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-6">
          <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
            <h2 className="mb-3 font-pa-display text-sm font-semibold text-pa-grey-04">Gap contribution by team</h2>
            <HBarChart rows={chartRows} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-pa-grey-01 bg-pa-white">
            <table className="min-w-full divide-y divide-pa-grey-01 font-pa-body text-sm">
              <thead className="bg-pa-grey-wash text-left text-xs font-medium uppercase tracking-wide text-pa-grey-03">
                <tr>
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2 text-right">Headcount</th>
                  <th className="px-3 py-2 text-right">Target</th>
                  <th className="px-3 py-2 text-right">Expected achievement</th>
                  <th className="px-3 py-2 text-right">Gap</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody data-testid="s2-team-drilldown-rows">
                {teamRows.map(({ teamKey, rollup, risk, gap }, index) => (
                  <tr
                    key={teamKey}
                    data-testid="s2-team-drilldown-row"
                    data-team-key={teamKey}
                    data-rank={index + 1}
                    className="border-t border-pa-grey-01"
                  >
                    <td className="px-3 py-2 font-pa-mono tabular-nums text-pa-grey-03">{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-pa-grey-04">{teamKey.replace('::', ' / ')}</td>
                    <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-03">{rollup.headcount}</td>
                    <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">£{round1(rollup.target)}k</td>
                    <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">
                      £{round1(rollup.expectedAchievement)}k
                    </td>
                    <td
                      data-testid="s2-team-drilldown-gap"
                      className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04"
                    >
                      {gap >= 0 ? '−' : '+'}£{round1(Math.abs(gap))}k
                      <span className="ml-1 text-xs text-pa-grey-02">{gap >= 0 ? 'shortfall' : 'surplus'}</span>
                    </td>
                    <td className="px-3 py-2 text-pa-grey-03">
                      <span className="font-pa-mono">{risk.confidence}</span>
                      <span className="ml-1 text-xs text-pa-grey-02">(simulated)</span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        data-testid="s2-team-drilldown-status"
                        data-status={risk.status}
                        className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(risk.status)}`}
                      >
                        {risk.status}
                      </span>
                      {risk.concentrationFlagged && (
                        <span className="ml-1 text-xs text-pa-apricot-04">concentration flagged</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
