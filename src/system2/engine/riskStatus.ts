import type { Division } from '../../system1/data/types'
import type { OrgRecord } from '../data/types'
import type { AggregationResult, Rollup } from './aggregation'
import { mulberry32, seedFromId } from './prng'

/**
 * S2-M3: risk status engine. Locked thresholds (CLAUDE.md):
 *   On track   -> forecast ratio >=100% AND confidence not Low
 *   At risk    -> forecast ratio 90-100%, OR confidence Low, OR concentration flagged
 *   Off track  -> forecast ratio <90%
 *   Infeasible -> goal can't be met even at maximum feasible capacity
 *
 * These four conditions overlap at the edges as literally stated (e.g. ratio
 * >=100% with Low confidence satisfies both "On track"'s ratio clause and
 * "At risk"'s confidence clause). Resolved by severity, most severe first:
 * Infeasible > Off track > At risk > On track. So a ratio <90% is always
 * Off track regardless of confidence/concentration (those only escalate an
 * otherwise-passing ratio, never downgrade a failing one), and On track
 * requires clearing every weaker condition, not just the ratio. This keeps
 * the function pure and total - every input combination maps to exactly one
 * status, which is what "same inputs always produce the same status" needs.
 *
 * Division/team status compares each group's own allocated target (from
 * aggregate()) against its own expected achievement - the same implicit-goal
 * logic already stated for Team drill-down's gap ranking, extended to
 * status. Only DES-wide takes an explicit `goal` override, since that's the
 * one Scenario Workspace (S2-M7) lever that changes a goal independent of
 * the imported targets.
 */

export type Confidence = 'High' | 'Medium' | 'Low'
export type RiskStatus = 'On track' | 'At risk' | 'Off track' | 'Infeasible'

/** Locked: capacity utilisation range is 0.75-1.05. "Maximum feasible capacity" for the Infeasible check means every record pushed to the top of that range. */
const MAX_FEASIBLE_CAPACITY_UTILISATION = 1.05

/**
 * Not locked in CLAUDE.md - a reasoned default. Below this headcount,
 * "a small share of the team accounts for most delivery" isn't a distinct
 * signal from "the team is small"; concentration risk doesn't meaningfully
 * apply, so groups smaller than this are never flagged.
 */
const MIN_HEADCOUNT_FOR_CONCENTRATION = 3
const CONCENTRATION_TOP_SHARE = 0.2
const CONCENTRATION_CONTRIBUTION_THRESHOLD = 0.5

function expectedAchievementFor(record: OrgRecord): number {
  return record.target * record.capacityUtilisation * record.teamHistoricalTrend
}

/**
 * Org-level flag only - never written back to individual records or System 1.
 * Flags a group where the top ~20% of headcount (ranked by individual
 * expected achievement) accounts for more than half the group's total.
 */
export function isConcentrationRisk(records: OrgRecord[]): boolean {
  if (records.length < MIN_HEADCOUNT_FOR_CONCENTRATION) return false

  const contributions = records.map(expectedAchievementFor).sort((a, b) => b - a)
  const total = contributions.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return false

  const topCount = Math.max(1, Math.ceil(records.length * CONCENTRATION_TOP_SHARE))
  const topSum = contributions.slice(0, topCount).reduce((sum, value) => sum + value, 0)
  return topSum / total > CONCENTRATION_CONTRIBUTION_THRESHOLD
}

/**
 * Simulated confidence - illustrative only, must stay visibly flagged as such
 * wherever shown in the UI. Deterministic per group via a seeded PRNG keyed
 * off a stable group identifier (division name, "division::team", or
 * "DES-wide"), never global Math.random - so the same group gets the same
 * confidence every time, on rerun or reimport alike.
 */
export function simulateConfidence(seedKey: string): Confidence {
  const rng = mulberry32(seedFromId(seedKey))
  const roll = rng()
  if (roll < 1 / 3) return 'Low'
  if (roll < 2 / 3) return 'Medium'
  return 'High'
}

function maxFeasibleExpectedAchievement(records: OrgRecord[]): number {
  return records.reduce(
    (sum, record) => sum + record.target * MAX_FEASIBLE_CAPACITY_UTILISATION * record.teamHistoricalTrend,
    0,
  )
}

export interface RiskAssessment {
  forecastRatio: number
  confidence: Confidence
  concentrationFlagged: boolean
  status: RiskStatus
}

export function assessRisk(rollup: Rollup, records: OrgRecord[], seedKey: string, goal: number = rollup.target): RiskAssessment {
  const forecastRatio = goal > 0 ? rollup.expectedAchievement / goal : 0
  const confidence = simulateConfidence(seedKey)
  const concentrationFlagged = isConcentrationRisk(records)
  const maxFeasible = maxFeasibleExpectedAchievement(records)

  let status: RiskStatus
  if (maxFeasible < goal) {
    status = 'Infeasible'
  } else if (forecastRatio < 0.9) {
    status = 'Off track'
  } else if (forecastRatio < 1 || confidence === 'Low' || concentrationFlagged) {
    status = 'At risk'
  } else {
    status = 'On track'
  }

  return { forecastRatio, confidence, concentrationFlagged, status }
}

export interface RiskStatusResult {
  desWide: RiskAssessment
  byDivision: Map<Division, RiskAssessment>
  byTeam: Map<string, RiskAssessment>
}

function groupRecords(records: OrgRecord[]): { byDivision: Map<Division, OrgRecord[]>; byTeam: Map<string, OrgRecord[]> } {
  const byDivision = new Map<Division, OrgRecord[]>()
  const byTeam = new Map<string, OrgRecord[]>()

  for (const record of records) {
    byDivision.set(record.division, [...(byDivision.get(record.division) ?? []), record])
    const teamKey = `${record.division}::${record.team}`
    byTeam.set(teamKey, [...(byTeam.get(teamKey) ?? []), record])
  }

  return { byDivision, byTeam }
}

/** desWideGoal defaults to the DES-wide target sum (coverage ~100% by construction, per the locked org-goal default) - S2-M7's "change goal" lever overrides it. */
export function computeRiskStatuses(
  records: OrgRecord[],
  aggregation: AggregationResult,
  desWideGoal: number = aggregation.desWide.target,
): RiskStatusResult {
  const { byDivision: divisionRecords, byTeam: teamRecords } = groupRecords(records)

  const desWide = assessRisk(aggregation.desWide, records, 'DES-wide', desWideGoal)

  const byDivision = new Map<Division, RiskAssessment>()
  for (const [division, rollup] of aggregation.byDivision) {
    byDivision.set(division, assessRisk(rollup, divisionRecords.get(division) ?? [], division))
  }

  const byTeam = new Map<string, RiskAssessment>()
  for (const [teamKey, rollup] of aggregation.byTeam) {
    byTeam.set(teamKey, assessRisk(rollup, teamRecords.get(teamKey) ?? [], teamKey))
  }

  return { desWide, byDivision, byTeam }
}
