import type { Division } from '../../system1/data/types'
import type { OrgRecord } from '../data/types'
import { aggregate, type AggregationResult } from './aggregation'
import { assessRisk, computeRiskStatuses, type Confidence, type RiskStatusResult } from './riskStatus'
import { computeGoals, type GoalResult } from './goals'

/**
 * S2-M7: the four locked Scenario Workspace levers, and the pure function
 * that runs them. Nothing here ever touches system2Store — a scenario is
 * computed by feeding the SAME real aggregate()/computeRiskStatuses()
 * functions a hypothetical records array/goal instead of the real ones,
 * exactly the same non-committing shape as System 1's What-if sandbox
 * (ManagerOverride.tsx's FactorSandbox) calling calculateModelledTarget() with hypothetical
 * inputs. The caller decides what's real and what's hypothetical; this file
 * never reads a store.
 */

export type CapacityScope = { level: 'division'; division: Division } | { level: 'team'; division: Division; team: string }

export interface GroupOverrideTarget {
  level: 'desWide' | 'division' | 'team'
  division?: Division
  team?: string
}

export interface ScenarioLevers {
  /** Lever 1: overrides computeRiskStatuses' desWideGoal. DES-wide only — the locked no-apportioning rule means divisions/teams never see this, same as the real (non-scenario) engine already enforces. */
  goal?: number
  /** Lever 2: multiplies capacityUtilisation for every record in the selected division/team. Cascades to parent rollups for free via aggregate()'s bottom-up sum. */
  capacityChange?: { scope: CapacityScope; multiplier: number }
  /** Lever 3: multiplies target for every imported record, unfiltered (confirmed scope) — same percent-adjustment shape as System 1's Mass adjustment, reimplemented for OrgRecord since System 2 never reads System 1's store. */
  populationAdjustmentPercent?: number
  /**
   * Lever 4: overrides expected achievement and/or confidence for exactly
   * one group's own row. Never cascades to parent rollups (confirmed
   * scope) — a division/team override does not change DES-wide, and a
   * team override does not change its parent division.
   */
  groupOverride?: { target: GroupOverrideTarget; expectedAchievement?: number; confidence?: Confidence }
}

function matchesCapacityScope(record: OrgRecord, scope: CapacityScope): boolean {
  if (scope.level === 'division') return record.division === scope.division
  return record.division === scope.division && record.team === scope.team
}

/**
 * Levers 2 and 3 only — the two that are genuine transforms of the input
 * records, applied before aggregation. Pure: returns a new array, the input
 * `records` (and every object in it) is never mutated.
 */
export function applyLeverTransforms(records: OrgRecord[], levers: ScenarioLevers): OrgRecord[] {
  return records.map((record) => {
    let next = record
    if (levers.capacityChange && matchesCapacityScope(record, levers.capacityChange.scope)) {
      next = { ...next, capacityUtilisation: next.capacityUtilisation * levers.capacityChange.multiplier }
    }
    if (levers.populationAdjustmentPercent) {
      next = { ...next, target: Math.round(next.target * (1 + levers.populationAdjustmentPercent / 100)) }
    }
    return next
  })
}

function recordsForGroup(records: OrgRecord[], target: GroupOverrideTarget): OrgRecord[] {
  if (target.level === 'desWide') return records
  if (target.level === 'division') return records.filter((r) => r.division === target.division)
  return records.filter((r) => r.division === target.division && r.team === target.team)
}

export interface ScenarioResult {
  aggregation: AggregationResult
  riskStatuses: RiskStatusResult
  /** Baseline goals (prior-year x 1.1), pinned to the real, untransformed records — never recomputed from lever-adjusted ones, so levers 2/3 (capacity/population changes) never silently drag the goal along with them. Only lever 1 overrides the DES-wide figure, applied by the caller reading `levers.goal ?? goals.desWide`. */
  goals: GoalResult
}

/**
 * Runs the real engine against lever-transformed records/goal, then layers
 * lever 4's group override on top as a leaf-level patch — via assessRisk(),
 * the exact function computeRiskStatuses already uses per group, so a
 * non-overridden group is byte-identical to what computeRiskStatuses alone
 * would have produced. The patch touches BOTH the returned aggregation and
 * riskStatuses for that one group, not just riskStatuses — a rollup and its
 * risk assessment must never disagree about the group's own expected
 * achievement (a screen showing "£42.7k expected, 110% forecast" side by
 * side would be internally inconsistent and wrong). If a group has both a
 * capacity/population change AND a lever-4 override, the override wins
 * outright — "what if it was actually X" is a deliberate manual
 * replacement, not something an automatic transform should still be
 * averaged against.
 *
 * Goals are computed once from the REAL, untransformed records (never the
 * lever-2/3-adjusted scenarioRecords) — see ScenarioResult.goals.
 */
export function runScenario(records: OrgRecord[], levers: ScenarioLevers): ScenarioResult {
  const goals = computeGoals(aggregate(records))
  const scenarioRecords = applyLeverTransforms(records, levers)
  const aggregation = aggregate(scenarioRecords)
  const riskStatuses = computeRiskStatuses(scenarioRecords, aggregation, goals, levers.goal)

  const override = levers.groupOverride
  if (!override || (override.expectedAchievement === undefined && override.confidence === undefined)) {
    return { aggregation, riskStatuses, goals }
  }

  const { target, expectedAchievement, confidence } = override
  const groupRecords = recordsForGroup(scenarioRecords, target)

  if (target.level === 'desWide') {
    const base = aggregation.desWide
    const rollup = { ...base, expectedAchievement: expectedAchievement ?? base.expectedAchievement }
    const goal = levers.goal ?? goals.desWide
    const risk = assessRisk(rollup, groupRecords, 'DES-wide', goal, confidence)
    return { aggregation: { ...aggregation, desWide: rollup }, riskStatuses: { ...riskStatuses, desWide: risk }, goals }
  }

  if (target.level === 'division') {
    const division = target.division!
    const base = aggregation.byDivision.get(division)
    if (!base) return { aggregation, riskStatuses, goals }
    const rollup = { ...base, expectedAchievement: expectedAchievement ?? base.expectedAchievement }
    const goal = goals.byDivision.get(division) ?? rollup.target
    const risk = assessRisk(rollup, groupRecords, division, goal, confidence)
    const byDivision = new Map(aggregation.byDivision)
    byDivision.set(division, rollup)
    const riskByDivision = new Map(riskStatuses.byDivision)
    riskByDivision.set(division, risk)
    return { aggregation: { ...aggregation, byDivision }, riskStatuses: { ...riskStatuses, byDivision: riskByDivision }, goals }
  }

  const teamKey = `${target.division}::${target.team}`
  const base = aggregation.byTeam.get(teamKey)
  if (!base) return { aggregation, riskStatuses, goals }
  const rollup = { ...base, expectedAchievement: expectedAchievement ?? base.expectedAchievement }
  const goal = goals.byTeam.get(teamKey) ?? rollup.target
  const risk = assessRisk(rollup, groupRecords, teamKey, goal, confidence)
  const byTeam = new Map(aggregation.byTeam)
  byTeam.set(teamKey, rollup)
  const riskByTeam = new Map(riskStatuses.byTeam)
  riskByTeam.set(teamKey, risk)
  return { aggregation: { ...aggregation, byTeam }, riskStatuses: { ...riskStatuses, byTeam: riskByTeam }, goals }
}
