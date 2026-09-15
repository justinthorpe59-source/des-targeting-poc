import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSystem2Store } from '../../store/system2Store'
import { useScenarioStore } from '../../store/scenarioStore'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses } from '../engine/riskStatus'
import { detectRiskExceptions, type RiskExceptionType } from '../engine/riskExceptions'

const TYPE_LABELS: Record<RiskExceptionType, string> = {
  'missing-forecast-data': 'Missing forecast data',
  infeasible: 'Infeasible',
  'low-confidence-high-reliance': 'Low confidence, high reliance',
  'large-unexplained-gap': 'Large unexplained gap',
}

const TYPE_BADGE_CLASS: Record<RiskExceptionType, string> = {
  'missing-forecast-data': 'bg-red-100 text-red-800',
  infeasible: 'bg-red-100 text-red-800',
  'low-confidence-high-reliance': 'bg-amber-100 text-amber-800',
  'large-unexplained-gap': 'bg-purple-100 text-purple-800',
}

const FILTER_OPTIONS: Array<RiskExceptionType | 'All'> = [
  'All',
  'missing-forecast-data',
  'infeasible',
  'low-confidence-high-reliance',
  'large-unexplained-gap',
]

/**
 * S2-M9: the last of the 6 locked System 2 screens. detectRiskExceptions()
 * is the only place these thresholds are implemented — this screen adds no
 * new detection logic, just a filtered list, same shape as System 1's
 * Exceptions queue (M9). Flags are recomputed live from the store on every
 * render; there's no separate "resolved" state — a group drops off this
 * list once its own numbers (or a saved scenario targeting it) change.
 */
export function RiskExceptions() {
  const records = useSystem2Store((state) => state.records)
  const savedScenarios = useScenarioStore((state) => state.scenarios)
  const [typeFilter, setTypeFilter] = useState<RiskExceptionType | 'All'>('All')

  const aggregation = useMemo(() => aggregate(records), [records])
  const riskStatuses = useMemo(() => computeRiskStatuses(records, aggregation), [records, aggregation])
  const flagsByGroup = useMemo(
    () => detectRiskExceptions({ aggregation, riskStatuses, savedScenarios }),
    [aggregation, riskStatuses, savedScenarios],
  )

  const rows = useMemo(() => {
    const entries = [...flagsByGroup.entries()]
      .map(([groupKey, flags]) => ({
        groupKey,
        level: flags[0].level,
        flags: typeFilter === 'All' ? flags : flags.filter((f) => f.type === typeFilter),
      }))
      .filter((row) => row.flags.length > 0)
    entries.sort((a, b) => a.groupKey.localeCompare(b.groupKey))
    return entries
  }, [flagsByGroup, typeFilter])

  if (records.length === 0) {
    return (
      <section className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Exceptions / risk flags</h1>
          <p className="mt-1 max-w-md text-sm text-slate-600">
            Divisions/teams that violate a locked threshold. Flagged for review only — nothing here is
            ever blocked.
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

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Exceptions / risk flags</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Divisions/teams that violate a locked threshold — missing forecast data, infeasible, low
          confidence with high reliance, or a large gap no scenario has tested yet. Flagged for review
          only; nothing here is ever blocked.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Type
          <select
            data-testid="s2-exceptions-type-filter"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as RiskExceptionType | 'All')}
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'All' ? 'All types' : TYPE_LABELS[opt]}
              </option>
            ))}
          </select>
        </label>
        <span data-testid="s2-exceptions-count" className="ml-auto text-sm text-slate-500">
          {rows.length} flagged group{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Level</th>
              <th className="px-3 py-2">Flags</th>
              <th className="px-3 py-2">Detail</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody data-testid="s2-exceptions-rows" className="divide-y divide-slate-100">
            {rows.map(({ groupKey, level, flags }) => (
              <tr key={groupKey} data-testid="s2-exceptions-row" data-group-key={groupKey} data-level={level}>
                <td className="px-3 py-2 font-medium text-slate-900">{groupKey.replace('::', ' / ')}</td>
                <td className="px-3 py-2 text-slate-600">{level === 'division' ? 'Division' : 'Team'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {flags.map((flag, i) => (
                      <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASS[flag.type]}`}>
                        {TYPE_LABELS[flag.type]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  <ul className="space-y-0.5">
                    {flags.map((flag, i) => (
                      <li key={i}>{flag.detail}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to={level === 'division' ? '/system2/division-comparison' : '/system2/team-drilldown'}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    {level === 'division' ? 'Division comparison →' : 'Team drill-down →'}
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                  No flagged groups{typeFilter !== 'All' ? ` of type "${TYPE_LABELS[typeFilter]}"` : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
