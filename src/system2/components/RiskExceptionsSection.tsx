import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSystem2Store } from '../../store/system2Store'
import { useScenarioStore } from '../../store/scenarioStore'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses, type RiskStatus } from '../engine/riskStatus'
import { computeGoals } from '../engine/goals'
import { detectRiskExceptions, type RiskExceptionType } from '../engine/riskExceptions'
import type { Division } from '../../system1/data/types'
import { round1 } from '../riskDisplay'
import { StatusPill } from '../../components/searchlight/StatusPill'

const TYPE_LABELS: Record<RiskExceptionType, string> = {
  'missing-forecast-data': 'Missing forecast data',
  infeasible: 'Infeasible',
  'low-confidence-high-reliance': 'Low confidence, high reliance',
  'large-unexplained-gap': 'Large unexplained gap',
}

/** Flag chip tones on the PA palette, severity-differentiated. */
const TYPE_TONE: Record<RiskExceptionType, { fill: string; text: string }> = {
  'missing-forecast-data': { fill: 'var(--color-pa-rose-01)', text: 'var(--color-pa-rose-04)' },
  infeasible: { fill: 'var(--color-pa-rose-01)', text: 'var(--color-pa-rose-04)' },
  'low-confidence-high-reliance': { fill: 'var(--color-pa-apricot-02)', text: 'var(--color-pa-grey-04)' },
  'large-unexplained-gap': { fill: 'var(--color-pa-aqua-02)', text: 'var(--color-pa-aqua-05)' },
}

/**
 * Flags whose detail sentence only restates the flag's own name — "expected
 * achievement can't reach the goal even at maximum feasible capacity" IS
 * what "Infeasible" means. Printing both put the same boilerplate on nearly
 * every row. The chip carries it; the sentence is dropped. The other two
 * flags' details each carry a figure that genuinely differs per group, so
 * those are kept.
 */
const DETAIL_RESTATES_CHIP: RiskExceptionType[] = ['infeasible', 'missing-forecast-data']

interface RiskRow {
  groupKey: string
  label: string
  level: 'division' | 'team'
  types: RiskExceptionType[]
  details: string[]
  gap: number
  status: RiskStatus
}

/**
 * The single Top Risks list at the foot of Executive Summary.
 *
 * This used to be two lists: a "Top risk drivers" card list (team, gap,
 * status) and, directly beneath it, a dense GROUP/LEVEL/FLAGS/DETAIL/ACTION
 * table over the same teams. They duplicated each other, and the table
 * repeated one boilerplate sentence in almost every row. Consolidated here
 * into one list, per the spec, which asks for a single Top Risks list in the
 * stat-tile / list-card language rather than a spreadsheet.
 *
 * What the table contributed and the cards did not — the specific flags, and
 * the one line of detail that actually differs per group — is folded into
 * the same row-card. Everything generic is gone.
 *
 * detectRiskExceptions() is still the only place the four locked thresholds
 * are implemented; gap and status come from the same aggregation the rest of
 * the screen reads, so the two can never disagree.
 */
export function RiskExceptionsSection() {
  const records = useSystem2Store((state) => state.records)
  const savedScenarios = useScenarioStore((state) => state.scenarios)

  const aggregation = useMemo(() => aggregate(records), [records])
  const goals = useMemo(() => computeGoals(aggregation), [aggregation])
  const riskStatuses = useMemo(
    () => computeRiskStatuses(records, aggregation, goals),
    [records, aggregation, goals],
  )
  const flagsByGroup = useMemo(
    () => detectRiskExceptions({ aggregation, riskStatuses, savedScenarios }),
    [aggregation, riskStatuses, savedScenarios],
  )

  const rows = useMemo<RiskRow[]>(() => {
    const out: RiskRow[] = []
    for (const [groupKey, flags] of flagsByGroup) {
      if (flags.length === 0) continue
      const level = flags[0].level
      const asDivision = groupKey as Division
      const rollup =
        level === 'division' ? aggregation.byDivision.get(asDivision) : aggregation.byTeam.get(groupKey)
      const goal = level === 'division' ? goals.byDivision.get(asDivision) : goals.byTeam.get(groupKey)
      const risk =
        level === 'division' ? riskStatuses.byDivision.get(asDivision) : riskStatuses.byTeam.get(groupKey)
      if (!rollup || goal === undefined || !risk) continue

      out.push({
        groupKey,
        label: groupKey.replace('::', ' / '),
        level,
        /* Drop an "Infeasible" chip when the status pill on the same row
           already says Infeasible — the chip and the pill are literally the
           same word, and printing both was the boilerplate problem again,
           one level down. Other flag types say something the status does
           not, so they stay. */
        types: flags
          .map((f) => f.type)
          .filter((t) => !(t === 'infeasible' && risk.status === 'Infeasible')),
        details: flags
          .filter((f) => !DETAIL_RESTATES_CHIP.includes(f.type))
          .map((f) => f.detail),
        gap: goal - rollup.expectedAchievement,
        status: risk.status,
      })
    }
    // Biggest contributors first — the ranking the old card list provided.
    return out.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
  }, [flagsByGroup, aggregation, goals, riskStatuses])

  if (records.length === 0) return null

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-pa-display text-base font-semibold text-pa-grey-04">Top risks</h2>
        <p className="mt-1 max-w-2xl font-pa-body text-sm text-pa-grey-03">
          Divisions and teams that violate a locked threshold, ranked by their contribution to the gap. Flagged
          for review only — nothing here is ever blocked.
        </p>
      </div>

      {rows.length === 0 ? (
        <p data-testid="s2-exceptions-empty" className="font-pa-body text-sm text-pa-grey-03">
          Nothing flagged right now.
        </p>
      ) : (
        <div data-testid="s2-exceptions-rows" className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.groupKey}
              data-testid="s2-exceptions-row"
              data-group-key={row.groupKey}
              data-level={row.level}
              className="rounded-pa-card px-6 py-4"
              style={{ background: 'var(--color-pa-grey-01)' }}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-pa-body text-sm font-semibold text-pa-grey-04">{row.label}</span>
                <span className="font-pa-body text-xs text-pa-grey-03">
                  {row.level === 'division' ? 'Division' : 'Team'}
                </span>
                <span className="font-pa-body text-xs text-pa-grey-03">
                  {row.gap >= 0 ? 'short of goal by' : 'above goal by'}{' '}
                  <span className="font-pa-mono font-semibold text-pa-grey-04">
                    £{round1(Math.abs(row.gap))}k
                  </span>
                </span>

                {row.types.map((type) => (
                  <span
                    key={type}
                    className="rounded-full px-2.5 py-1 font-pa-body text-[11px] font-semibold"
                    style={{ background: TYPE_TONE[type].fill, color: TYPE_TONE[type].text }}
                  >
                    {TYPE_LABELS[type]}
                  </span>
                ))}

                <span className="ml-auto flex shrink-0 items-center gap-4">
                  <StatusPill risk={row.status} />
                  <Link
                    to="/system2/division-comparison"
                    className="font-pa-body text-xs font-semibold text-pa-aqua-05 hover:text-pa-aqua-04"
                  >
                    {row.level === 'division' ? 'Compare →' : 'Find →'}
                  </Link>
                </span>
              </div>

              {/* Only the detail that actually differs per group survives. */}
              {row.details.length > 0 && (
                <p className="mt-2 font-pa-body text-xs text-pa-grey-03">{row.details.join(' · ')}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
