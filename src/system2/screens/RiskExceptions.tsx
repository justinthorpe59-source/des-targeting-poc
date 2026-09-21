import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSystem2Store } from '../../store/system2Store'
import { useScenarioStore } from '../../store/scenarioStore'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses } from '../engine/riskStatus'
import { detectRiskExceptions, type RiskExceptionType } from '../engine/riskExceptions'
import { ScreenHeading } from '../../components/searchlight/ScreenHeading'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchDistribution } from '../../components/searchlight/SketchIllustrations'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'

const TYPE_LABELS: Record<RiskExceptionType, string> = {
  'missing-forecast-data': 'Missing forecast data',
  infeasible: 'Infeasible',
  'low-confidence-high-reliance': 'Low confidence, high reliance',
  'large-unexplained-gap': 'Large unexplained gap',
}

// Severity-differentiated per the PA palette (Searchlight design pass) — the
// two hard-fail types in Ingenuity Red, low-confidence in Apricot, and the
// untested-gap flag in Rose. Replaces the old red/amber/purple set (purple
// isn't a PA colour).
const TYPE_BADGE_CLASS: Record<RiskExceptionType, string> = {
  'missing-forecast-data': 'bg-[#fdecee] text-pa-ingenuity-red',
  infeasible: 'bg-[#fdecee] text-pa-ingenuity-red',
  'low-confidence-high-reliance': 'bg-pa-apricot-02 text-pa-grey-04',
  'large-unexplained-gap': 'bg-pa-rose-01 text-pa-rose-04',
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
 * new detection logic, just a filtered list. Searchlight design pass added
 * the loader, distribution motif (tails = exceptions) and token styling;
 * detection and filtering are unchanged.
 */
export function RiskExceptions() {
  const records = useSystem2Store((state) => state.records)
  const savedScenarios = useScenarioStore((state) => state.scenarios)
  const [typeFilter, setTypeFilter] = useState<RiskExceptionType | 'All'>('All')
  const loading = useInitialLoad(records.length > 0)

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
        <ScreenHeading title="Exceptions / risk flags">
          Divisions/teams that violate a locked threshold. Flagged for review only — nothing here is
          ever blocked.
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

  return (
    <section className="relative space-y-6">
      <SketchDistribution className="pointer-events-none absolute right-0 top-8 -z-10 h-[340px] w-[560px] max-w-none opacity-[0.06]" />

      <ScreenHeading title="Exceptions / risk flags">
        Divisions/teams that violate a locked threshold — missing forecast data, infeasible, low
        confidence with high reliance, or a large gap no scenario has tested yet. Flagged for review
        only; nothing here is ever blocked.
      </ScreenHeading>

      {loading ? (
        <SearchlightLoader />
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-6">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 font-pa-body text-xs font-medium text-pa-grey-03">
              Type
              <select
                data-testid="s2-exceptions-type-filter"
                className="rounded-md border border-pa-grey-02 bg-pa-white px-2 py-1.5 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none"
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
            <span data-testid="s2-exceptions-count" className="ml-auto font-pa-body text-sm text-pa-grey-03">
              {rows.length} flagged group{rows.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-pa-grey-01 bg-pa-white">
            <table className="min-w-full divide-y divide-pa-grey-01 font-pa-body text-sm">
              <thead className="bg-pa-grey-wash text-left text-xs font-medium uppercase tracking-wide text-pa-grey-03">
                <tr>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">Flags</th>
                  <th className="px-3 py-2">Detail</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody data-testid="s2-exceptions-rows" className="divide-y divide-pa-grey-01">
                {rows.map(({ groupKey, level, flags }) => (
                  <tr key={groupKey} data-testid="s2-exceptions-row" data-group-key={groupKey} data-level={level}>
                    <td className="px-3 py-2 font-medium text-pa-grey-04">{groupKey.replace('::', ' / ')}</td>
                    <td className="px-3 py-2 text-pa-grey-03">{level === 'division' ? 'Division' : 'Team'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {flags.map((flag, i) => (
                          <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASS[flag.type]}`}>
                            {TYPE_LABELS[flag.type]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-pa-grey-03">
                      <ul className="space-y-0.5">
                        {flags.map((flag, i) => (
                          <li key={i}>{flag.detail}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={level === 'division' ? '/system2/division-comparison' : '/system2/team-drilldown'}
                        className="text-xs font-medium text-pa-aqua-05 hover:text-pa-aqua-04"
                      >
                        {level === 'division' ? 'Division comparison →' : 'Team drill-down →'}
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center font-pa-body text-sm text-pa-grey-03">
                      No flagged groups{typeFilter !== 'All' ? ` of type "${TYPE_LABELS[typeFilter]}"` : ''}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
