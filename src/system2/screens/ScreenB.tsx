import { useMemo } from 'react'
import { useSystem2Store } from '../../store/system2Store'
import { aggregate } from '../engine/aggregation'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// S2-M1 placeholder — same shared store as Screen A, read-only here, to
// prove the imported records really are shared state within System 2, not
// screen-local. If this doesn't match Screen A's count, the store isn't
// wired up correctly.
// S2-M2: rollups by team/division/DES-wide, added purely for live
// verification of the aggregation engine — not a real screen. Executive
// summary (S2-M4) and Division comparison (S2-M5) are the real consumers.
export function ScreenB() {
  const records = useSystem2Store((state) => state.records)
  const rollups = useMemo(() => aggregate(records), [records])

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">Screen B (S2-M1/M2 placeholder)</h1>
      <p className="max-w-md text-sm text-slate-600">
        Same imported records as Screen A, read from the same store, plus their team/division/DES-wide
        rollups.
      </p>
      <div className="flex items-center gap-3">
        <span data-testid="s2-imported-count" className="text-3xl font-bold tabular-nums">
          {records.length}
        </span>
        <span className="text-sm text-slate-500">records</span>
      </div>

      {records.length > 0 && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">DES-wide</h2>
            <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">Headcount</div>
                <div data-testid="s2-deswide-headcount" className="text-lg font-bold tabular-nums text-slate-900">
                  {rollups.desWide.headcount}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Target</div>
                <div data-testid="s2-deswide-target" className="text-lg font-bold tabular-nums text-slate-900">
                  £{round1(rollups.desWide.target)}k
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Expected achievement</div>
                <div
                  data-testid="s2-deswide-expected"
                  className="text-lg font-bold tabular-nums text-slate-900"
                >
                  £{round1(rollups.desWide.expectedAchievement)}k
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Division</th>
                  <th className="px-3 py-2 text-right">Headcount</th>
                  <th className="px-3 py-2 text-right">Target</th>
                  <th className="px-3 py-2 text-right">Expected achievement</th>
                </tr>
              </thead>
              <tbody data-testid="s2-division-rows">
                {[...rollups.byDivision.entries()].map(([division, rollup]) => (
                  <tr key={division} data-testid="s2-division-row" data-division={division} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{division}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{rollup.headcount}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">£{round1(rollup.target)}k</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                      £{round1(rollup.expectedAchievement)}k
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2 text-right">Headcount</th>
                  <th className="px-3 py-2 text-right">Target</th>
                  <th className="px-3 py-2 text-right">Expected achievement</th>
                </tr>
              </thead>
              <tbody data-testid="s2-team-rows">
                {[...rollups.byTeam.entries()].map(([teamKey, rollup]) => (
                  <tr key={teamKey} data-testid="s2-team-row" data-team-key={teamKey} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{teamKey.replace('::', ' / ')}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{rollup.headcount}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">£{round1(rollup.target)}k</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                      £{round1(rollup.expectedAchievement)}k
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Division</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2 text-right">Target</th>
                  <th className="px-3 py-2 text-right">Capacity util.</th>
                  <th className="px-3 py-2 text-right">Team trend</th>
                </tr>
              </thead>
              <tbody data-testid="s2-imported-rows">
                {records.map((r) => (
                  <tr key={r.id} data-testid="s2-imported-row" data-person-id={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.id}</td>
                    <td className="px-3 py-2 text-slate-600">{r.division}</td>
                    <td className="px-3 py-2 text-slate-600">{r.team}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">£{r.target}k</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">{r.capacityUtilisation}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">{r.teamHistoricalTrend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
