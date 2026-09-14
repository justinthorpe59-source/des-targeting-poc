import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSystem2Store } from '../../store/system2Store'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses } from '../engine/riskStatus'
import { round1, statusBadgeClass } from '../riskDisplay'

/**
 * S2-M6: teams ranked by contribution to the gap. Locked rule: this does
 * NOT apportion the DES-wide goal down to team level — each team compares
 * its own allocated target to its own expected achievement (exactly what
 * computeRiskStatuses' byTeam already computes, goal defaulting to the
 * team's own rollup.target). Ranking is by absolute gap, so a team running
 * ahead of its own target sorts by the same magnitude as one running
 * behind — sign only changes the label (shortfall vs surplus), not the
 * rank.
 *
 * Replaces ScreenB, which existed purely to verify the S2-M2/M3 engines
 * before a real screen consumed their team-level output.
 */
export function TeamDrillDown() {
  const records = useSystem2Store((state) => state.records)
  const rollups = useMemo(() => aggregate(records), [records])
  const riskStatuses = useMemo(() => computeRiskStatuses(records, rollups), [records, rollups])

  if (records.length === 0) {
    return (
      <section className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Team drill-down</h1>
          <p className="mt-1 max-w-md text-sm text-slate-600">
            Teams ranked by their absolute contribution to the gap between target and expected
            achievement.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No snapshot imported yet.{' '}
          <Link to="/system2/executive-summary" className="font-medium text-slate-900 underline">
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

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Team drill-down</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Teams ranked by their absolute contribution to the gap between target and expected
          achievement — each team against its own target, not a slice of the DES-wide goal.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
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
                className="border-t border-slate-100"
              >
                <td className="px-3 py-2 tabular-nums text-slate-500">{index + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{teamKey.replace('::', ' / ')}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{rollup.headcount}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">£{round1(rollup.target)}k</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  £{round1(rollup.expectedAchievement)}k
                </td>
                <td
                  data-testid="s2-team-drilldown-gap"
                  className="px-3 py-2 text-right tabular-nums text-slate-900"
                >
                  {gap >= 0 ? '−' : '+'}£{round1(Math.abs(gap))}k
                  <span className="ml-1 text-xs text-slate-400">{gap >= 0 ? 'shortfall' : 'surplus'}</span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {risk.confidence}
                  <span className="ml-1 text-xs text-slate-400">(simulated)</span>
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
                    <span className="ml-1 text-xs text-amber-700">concentration flagged</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
