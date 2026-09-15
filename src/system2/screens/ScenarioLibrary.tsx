import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSystem2Store } from '../../store/system2Store'
import { useScenarioStore, type SavedScenario } from '../../store/scenarioStore'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses } from '../engine/riskStatus'
import { runScenario, type ScenarioLevers } from '../engine/scenario'
import { round1, statusBadgeClass } from '../riskDisplay'

function describeLevers(levers: ScenarioLevers): string {
  const parts: string[] = []
  if (levers.goal !== undefined) parts.push(`Goal → £${round1(levers.goal)}k`)
  if (levers.capacityChange) {
    const { scope, multiplier } = levers.capacityChange
    const pct = round1((multiplier - 1) * 100)
    const label = scope.level === 'division' ? scope.division : `${scope.division} / ${scope.team}`
    parts.push(`Capacity ${label} ${pct >= 0 ? '+' : ''}${pct}%`)
  }
  if (levers.populationAdjustmentPercent) {
    parts.push(`Population ${levers.populationAdjustmentPercent >= 0 ? '+' : ''}${levers.populationAdjustmentPercent}%`)
  }
  if (levers.groupOverride) {
    const { target, expectedAchievement, confidence } = levers.groupOverride
    const label =
      target.level === 'desWide' ? 'DES-wide' : target.level === 'division' ? target.division : `${target.division} / ${target.team}`
    const bits: string[] = []
    if (expectedAchievement !== undefined) bits.push(`EA → £${round1(expectedAchievement)}k`)
    if (confidence !== undefined) bits.push(`Confidence → ${confidence}`)
    parts.push(`${label}: ${bits.join(', ')}`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'No levers'
}

/**
 * S2-M8: browse, reopen, and compare saved scenarios. Owns none of the
 * calculation — a saved scenario is just a lever config (S2-M7's
 * scenarioStore), and "reopening" it is running the exact same pure
 * runScenario(records, levers) that Scenario workspace already uses. That's
 * what makes "reopened later, shows exactly the same result" hold: it's a
 * live recomputation from the same inputs, not a cached snapshot of numbers
 * that could go stale or disagree with the engine.
 */
export function ScenarioLibrary() {
  const records = useSystem2Store((state) => state.records)
  const scenarios = useScenarioStore((state) => state.scenarios)
  const deleteScenario = useScenarioStore((state) => state.deleteScenario)

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const baselineAggregation = useMemo(() => aggregate(records), [records])
  const baselineRisk = useMemo(() => computeRiskStatuses(records, baselineAggregation), [records, baselineAggregation])

  const results = useMemo(() => {
    const map = new Map<string, ReturnType<typeof runScenario>>()
    for (const scenario of scenarios) {
      map.set(scenario.id, runScenario(records, scenario.levers))
    }
    return map
  }, [scenarios, records])

  if (records.length === 0) {
    return (
      <section className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Scenario library</h1>
          <p className="mt-1 max-w-md text-sm text-slate-600">Saved scenarios, reopened and compared side by side.</p>
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

  if (scenarios.length === 0) {
    return (
      <section className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Scenario library</h1>
          <p className="mt-1 max-w-md text-sm text-slate-600">Saved scenarios, reopened and compared side by side.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No scenarios saved yet.{' '}
          <Link to="/system2/scenario-workspace" className="font-medium text-slate-900 underline">
            Build one in Scenario workspace
          </Link>{' '}
          and save it to see it here.
        </div>
      </section>
    )
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectedScenarios = scenarios.filter((s) => selectedIds.includes(s.id))

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Scenario library</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Saved scenarios, reopened and compared side by side. Select scenarios below to add them to the
          comparison table.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Levers</th>
              <th className="px-3 py-2">Saved</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody data-testid="scenario-library-rows">
            {scenarios.map((scenario: SavedScenario) => (
              <tr key={scenario.id} data-testid="scenario-library-row" data-scenario-id={scenario.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    data-testid="scenario-library-select"
                    checked={selectedIds.includes(scenario.id)}
                    onChange={() => toggleSelected(scenario.id)}
                  />
                </td>
                <td className="px-3 py-2 font-medium text-slate-900">{scenario.name}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{describeLevers(scenario.levers)}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{scenario.savedAt}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    data-testid="scenario-library-delete"
                    onClick={() => {
                      deleteScenario(scenario.id)
                      setSelectedIds((prev) => prev.filter((x) => x !== scenario.id))
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700">DES-wide comparison</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2 text-right">Goal</th>
                <th className="px-3 py-2 text-right">Forecast</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr data-testid="scenario-compare-baseline" className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-500">Baseline</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">£{round1(baselineAggregation.desWide.target)}k</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {round1(baselineRisk.desWide.forecastRatio * 100)}%
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {baselineRisk.desWide.confidence}
                  <span className="ml-1 text-xs text-slate-400">(simulated)</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(baselineRisk.desWide.status)}`}>
                    {baselineRisk.desWide.status}
                  </span>
                </td>
              </tr>
              {selectedScenarios.map((scenario) => {
                const result = results.get(scenario.id)!
                const goal = scenario.levers.goal ?? result.aggregation.desWide.target
                return (
                  <tr key={scenario.id} data-testid="scenario-compare-row" data-scenario-id={scenario.id} className="border-t border-slate-100 bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{scenario.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">£{round1(goal)}k</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                      {round1(result.riskStatuses.desWide.forecastRatio * 100)}%
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {result.riskStatuses.desWide.confidence}
                      <span className="ml-1 text-xs text-slate-400">(simulated)</span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        data-testid="scenario-compare-status"
                        data-status={result.riskStatuses.desWide.status}
                        className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(result.riskStatuses.desWide.status)}`}
                      >
                        {result.riskStatuses.desWide.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {selectedScenarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                    Select one or more scenarios above to compare them against baseline.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
