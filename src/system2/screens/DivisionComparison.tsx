import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSystem2Store } from '../../store/system2Store'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses } from '../engine/riskStatus'
import { round1, statusBadgeClass, statusFill } from '../riskDisplay'
import { ScreenHeading } from '../components/ScreenHeading'
import { SearchlightLoader } from '../components/SearchlightLoader'
import { SketchScatter } from '../components/SketchIllustrations'
import { HBarChart } from '../components/HBarChart'
import { useInitialLoad } from '../components/useInitialLoad'

/**
 * S2-M5: coverage/forecast/confidence/status side by side across divisions.
 * Reads the same aggregate()/computeRiskStatuses() output ScreenB has been
 * exercising since S2-M2/M3 — no new calculation added. Searchlight design
 * pass added the loader, scatter motif and a token-styled forecast bar
 * chart (standard chart, not a custom viz); the table logic is unchanged.
 *
 * "Coverage" here follows the risk engine's own no-apportioning rule
 * (riskStatus.ts): a division's implicit goal is its own target, same as a
 * team's. So coverage = target / target = 100% for every division until
 * S2-M7 adds a lever that changes it.
 *
 * Acceptance signal: every division in the imported snapshot appears, no
 * omissions. Satisfied by iterating rollups.byDivision directly.
 */
export function DivisionComparison() {
  const records = useSystem2Store((state) => state.records)
  const rollups = useMemo(() => aggregate(records), [records])
  const riskStatuses = useMemo(() => computeRiskStatuses(records, rollups), [records, rollups])
  const loading = useInitialLoad(records.length > 0)

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

  const divisionRows = [...rollups.byDivision.entries()].map(([division, rollup]) => {
    const risk = riskStatuses.byDivision.get(division)!
    const coverage = rollup.target > 0 ? (rollup.target / rollup.target) * 100 : 0
    return { division, rollup, risk, coverage }
  })

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
        Coverage, forecast, confidence and status side by side across DES&apos;s divisions. Coverage is
        100% by construction until a goal is changed (S2-M7).
      </ScreenHeading>

      {loading ? (
        <SearchlightLoader />
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-6">
          <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
            <h2 className="mb-3 font-pa-display text-sm font-semibold text-pa-grey-04">Forecast by division</h2>
            <HBarChart rows={chartRows} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-pa-grey-01 bg-pa-white">
            <table className="min-w-full divide-y divide-pa-grey-01 font-pa-body text-sm">
              <thead className="bg-pa-grey-wash text-left text-xs font-medium uppercase tracking-wide text-pa-grey-03">
                <tr>
                  <th className="px-3 py-2">Division</th>
                  <th className="px-3 py-2 text-right">Headcount</th>
                  <th className="px-3 py-2 text-right">Target</th>
                  <th className="px-3 py-2 text-right">Coverage</th>
                  <th className="px-3 py-2 text-right">Forecast</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody data-testid="s2-division-comparison-rows">
                {divisionRows.map(({ division, rollup, risk, coverage }) => (
                  <tr
                    key={division}
                    data-testid="s2-division-comparison-row"
                    data-division={division}
                    className="border-t border-pa-grey-01"
                  >
                    <td className="px-3 py-2 font-medium text-pa-grey-04">{division}</td>
                    <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-03">{rollup.headcount}</td>
                    <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">£{round1(rollup.target)}k</td>
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
