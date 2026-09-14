import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSystem2Store } from '../../store/system2Store'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses } from '../engine/riskStatus'
import { round1, statusBadgeClass } from '../riskDisplay'

/**
 * S2-M5: coverage/forecast/confidence/status side by side across divisions.
 * Reads the same aggregate()/computeRiskStatuses() output ScreenB has been
 * exercising since S2-M2/M3 — no new calculation added.
 *
 * "Coverage" here follows the risk engine's own no-apportioning rule
 * (riskStatus.ts): a division's implicit goal is its own target, same as a
 * team's. So coverage = target / target = 100% for every division until
 * S2-M7 adds a lever that changes it — same caveat Executive summary (S2-M4)
 * already shows for the DES-wide figure, not a bug specific to this screen.
 *
 * Acceptance signal: every division in the imported snapshot appears, no
 * omissions. Satisfied by iterating rollups.byDivision directly rather than
 * a hardcoded division list — a division with zero imported records simply
 * has no entry in that map and correctly doesn't appear.
 */
export function DivisionComparison() {
  const records = useSystem2Store((state) => state.records)
  const rollups = useMemo(() => aggregate(records), [records])
  const riskStatuses = useMemo(() => computeRiskStatuses(records, rollups), [records, rollups])

  if (records.length === 0) {
    return (
      <section className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Division comparison</h1>
          <p className="mt-1 max-w-md text-sm text-slate-600">
            Coverage, forecast, confidence and status side by side across DES's divisions.
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

  const divisionRows = [...rollups.byDivision.entries()].map(([division, rollup]) => {
    const risk = riskStatuses.byDivision.get(division)!
    const coverage = rollup.target > 0 ? (rollup.target / rollup.target) * 100 : 0
    return { division, rollup, risk, coverage }
  })

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Division comparison</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Coverage, forecast, confidence and status side by side across DES's divisions. Coverage is
          100% by construction until a goal is changed (S2-M7).
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
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
                className="border-t border-slate-100"
              >
                <td className="px-3 py-2 font-medium text-slate-900">{division}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{rollup.headcount}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">£{round1(rollup.target)}k</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">{round1(coverage)}%</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {round1(risk.forecastRatio * 100)}%
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {risk.confidence}
                  <span className="ml-1 text-xs text-slate-400">(simulated)</span>
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
