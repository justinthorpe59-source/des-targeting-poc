import { SEED_PEOPLE } from '../data/people'
import type { Person } from '../data/types'
import { computeRevenueCohortAverages } from '../engine/cohortAverages'
import { combinedRevenueFor } from '../engine/revenueEngine'
import { HBarChart } from '../../components/searchlight/HBarChart'

function deltaLabel(value: number, baseline: number): string {
  if (baseline === 0) return ''
  const pct = Math.round(((value - baseline) / baseline) * 100)
  if (pct === 0) return 'in line with'
  return pct > 0 ? `${pct}% above` : `${Math.abs(pct)}% below`
}

/**
 * Cohort-comparison content (M6 logic) — person vs team average vs division
 * average, plus a plain-language delta sentence. Renders as the panel on
 * Individual Detail, which since the 5-screen consolidation is its only
 * home — the standalone Cohort comparison screen it used to also serve has
 * been deleted. Averaging lives in cohortAverages.ts.
 */
export function CohortComparisonPanel({ person }: { person: Person }) {
  const averages = computeRevenueCohortAverages(person, SEED_PEOPLE)
  const personValue = combinedRevenueFor(person)

  return (
    <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
      <h2 className="font-pa-display text-sm font-semibold text-pa-grey-04">
        Cohort comparison — {person.division} / {person.team}
      </h2>
      <p className="mt-1 font-pa-body text-xs text-pa-grey-03">
        Revenue contribution against anonymised team and division averages.
      </p>
      <div className="mt-4">
        <HBarChart
          rows={[
            {
              key: 'person',
              label: `${person.name} (this person)`,
              value: personValue,
              display: `£${Math.round(personValue)}k`,
              fill: 'var(--color-pa-aqua-04)',
              testId: 'cohort-person-value',
            },
            {
              key: 'team',
              label: `${person.team} team average`,
              value: averages.teamAverage,
              display: `£${Math.round(averages.teamAverage)}k`,
              fill: 'var(--color-pa-aqua-03)',
              testId: 'cohort-team-value',
            },
            {
              key: 'division',
              label: `${person.division} division average`,
              value: averages.divisionAverage,
              display: `£${Math.round(averages.divisionAverage)}k`,
              fill: 'var(--color-pa-grey-02)',
              testId: 'cohort-division-value',
            },
          ]}
        />
      </div>
      <p className="mt-4 font-pa-body text-sm text-pa-grey-04">
        <span className="font-pa-mono">£{personValue}k</span> is {deltaLabel(personValue, averages.teamAverage)} the{' '}
        {person.team} team average (<span className="font-pa-mono">£{Math.round(averages.teamAverage)}k</span>), and{' '}
        {deltaLabel(personValue, averages.divisionAverage)} the {person.division} division average (
        <span className="font-pa-mono">£{Math.round(averages.divisionAverage)}k</span>).
      </p>
    </div>
  )
}
