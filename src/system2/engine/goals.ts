import type { Division } from '../../system1/data/types'
import type { AggregationResult } from './aggregation'
import { mulberry32, randRange, seedFromId } from './prng'

/**
 * The organisational goal, fixed. Previously "goal" was defined as the sum
 * of imported targets — circular, since that made coverage trivially ~100%
 * by construction (the goal was just restating the input). This replaces
 * that with a real baseline-plus-growth model: a fabricated prior-year
 * revenue figure per team, generated deterministically from that team's own
 * current combined-revenue figure (aggregation.byTeam's target) with a
 * seeded growth-rate jitter — not identical to this year's number, and not
 * uniform across teams (the range below skews toward growth, so most teams
 * come out ahead of last year, a couple flat, one or two down).
 *
 * Stored at team level and rolled up to division/DES-wide by summing — the
 * same way current revenue already aggregates through the hierarchy, never
 * apportioned top-down (the locked no-apportioning rule). GOAL = prior-year
 * revenue x 1.10 at every level. Because summing is linear, "goal = sum(team
 * priorYear) x 1.1" is identical whether computed scale-then-sum or
 * sum-then-scale, so division/team goals always sum correctly to the
 * DES-wide goal.
 *
 * Computed from the real (imported/baseline) aggregation only — never from a
 * scenario-transformed one. A lever that changes this year's targets or
 * capacity must never silently drag the goal along with it; prior-year
 * revenue is a historical fact, independent of what this year's numbers get
 * tweaked to. Only Scenario Workspace's explicit "change the goal" lever
 * (DES-wide only, per the locked rule) may override the computed figure.
 */
const GROWTH_RATE_RANGE = [-0.05, 0.12] as const
const GOAL_GROWTH_MULTIPLIER = 1.1

export interface GoalResult {
  desWide: number
  byDivision: Map<Division, number>
  byTeam: Map<string, number>
}

function priorYearRevenueFor(teamKey: string, currentRevenue: number): number {
  const rng = mulberry32(seedFromId(`prior-year::${teamKey}`))
  const growthRate = randRange(rng, ...GROWTH_RATE_RANGE)
  return currentRevenue / (1 + growthRate)
}

export function computeGoals(aggregation: AggregationResult): GoalResult {
  const byTeam = new Map<string, number>()
  const byDivision = new Map<Division, number>()
  let desWide = 0

  for (const [teamKey, rollup] of aggregation.byTeam) {
    const priorYear = priorYearRevenueFor(teamKey, rollup.target)
    const goal = priorYear * GOAL_GROWTH_MULTIPLIER
    byTeam.set(teamKey, goal)
    desWide += goal
    const division = teamKey.split('::')[0] as Division
    byDivision.set(division, (byDivision.get(division) ?? 0) + goal)
  }

  return { desWide, byDivision, byTeam }
}
