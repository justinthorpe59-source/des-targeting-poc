import type { AggregationResult, Rollup } from './aggregation'
import type { RiskAssessment, RiskStatusResult } from './riskStatus'
import type { ScenarioLevers } from './scenario'
import type { SavedScenario } from '../../store/scenarioStore'

/**
 * S2-M9: same shape as System 1's exceptions.ts — one shared detector, a
 * Map<groupKey, flags[]> so a group can carry more than one flag, nothing
 * here ever blocks anything. Locked thresholds (CLAUDE.md):
 *  - missing-forecast-data: a team/division missing expected achievement or
 *    confidence
 *  - infeasible: expected achievement can't reach the goal even at maximum
 *    assumed capacity — reads the same `status` field every other screen
 *    already shows, no new computation
 *  - low-confidence-high-reliance: Low confidence but responsible for >30%
 *    of expected achievement
 *  - large-unexplained-gap: forecast >20% below goal with no scenario
 *    tested against it yet — "tested" means a saved scenario (S2-M8) whose
 *    levers actually target this specific division/team, not just any
 *    saved scenario existing
 *
 * Scoped to divisions/teams only, per the screen's own name — DES-wide
 * doesn't get a row here (Executive summary already surfaces its Infeasible/
 * At risk/Off track status directly).
 */

export type RiskExceptionType = 'missing-forecast-data' | 'infeasible' | 'low-confidence-high-reliance' | 'large-unexplained-gap'
export type GroupLevel = 'division' | 'team'

/** Below this, "more than 30% of expected achievement" isn't a meaningful reliance signal — same reasoning as riskStatus.ts's own MIN_HEADCOUNT_FOR_CONCENTRATION, not a locked number. */
const LARGE_GAP_RATIO_THRESHOLD = 0.8
const HIGH_RELIANCE_SHARE_THRESHOLD = 0.3

export interface RiskExceptionFlag {
  groupKey: string
  level: GroupLevel
  type: RiskExceptionType
  detail: string
}

interface DetectRiskExceptionsInput {
  aggregation: AggregationResult
  riskStatuses: RiskStatusResult
  savedScenarios: SavedScenario[]
}

/** True if a saved scenario's levers actually target this exact division/team — the only thing that counts as "tested" for the large-unexplained-gap threshold. */
function leversTargetGroup(levers: ScenarioLevers, level: GroupLevel, groupKey: string): boolean {
  if (levers.capacityChange) {
    const { scope } = levers.capacityChange
    const scopeKey = scope.level === 'division' ? scope.division : `${scope.division}::${scope.team}`
    if (scope.level === level && scopeKey === groupKey) return true
  }
  if (levers.groupOverride) {
    const { target } = levers.groupOverride
    if (target.level === 'division' && level === 'division' && target.division === groupKey) return true
    if (target.level === 'team' && level === 'team' && `${target.division}::${target.team}` === groupKey) return true
  }
  return false
}

function evaluateGroup(
  groupKey: string,
  level: GroupLevel,
  rollup: Rollup,
  risk: RiskAssessment | undefined,
  desWideExpectedAchievement: number,
  savedScenarios: SavedScenario[],
): RiskExceptionFlag[] {
  const flags: RiskExceptionFlag[] = []

  if (!risk || !Number.isFinite(rollup.expectedAchievement) || !Number.isFinite(risk.forecastRatio)) {
    flags.push({
      groupKey,
      level,
      type: 'missing-forecast-data',
      detail: 'expected achievement or confidence is missing for this group',
    })
    return flags // nothing else here is meaningful to check without a real risk assessment
  }

  if (risk.status === 'Infeasible') {
    flags.push({
      groupKey,
      level,
      type: 'infeasible',
      detail: "expected achievement can't reach the goal even at maximum feasible capacity",
    })
  }

  if (risk.confidence === 'Low' && desWideExpectedAchievement > 0) {
    const share = rollup.expectedAchievement / desWideExpectedAchievement
    if (share > HIGH_RELIANCE_SHARE_THRESHOLD) {
      flags.push({
        groupKey,
        level,
        type: 'low-confidence-high-reliance',
        detail: `Low confidence but responsible for ${Math.round(share * 100)}% of DES-wide expected achievement`,
      })
    }
  }

  if (risk.forecastRatio < LARGE_GAP_RATIO_THRESHOLD) {
    const tested = savedScenarios.some((s) => leversTargetGroup(s.levers, level, groupKey))
    if (!tested) {
      const belowPct = Math.round((1 - risk.forecastRatio) * 100)
      flags.push({
        groupKey,
        level,
        type: 'large-unexplained-gap',
        detail: `forecast is ${belowPct}% below goal, and no saved scenario has targeted this group yet`,
      })
    }
  }

  return flags
}

export function detectRiskExceptions({ aggregation, riskStatuses, savedScenarios }: DetectRiskExceptionsInput): Map<string, RiskExceptionFlag[]> {
  const flagsByGroup = new Map<string, RiskExceptionFlag[]>()
  const desWideExpectedAchievement = aggregation.desWide.expectedAchievement

  for (const [division, rollup] of aggregation.byDivision) {
    const flags = evaluateGroup(division, 'division', rollup, riskStatuses.byDivision.get(division), desWideExpectedAchievement, savedScenarios)
    if (flags.length > 0) flagsByGroup.set(division, flags)
  }

  for (const [teamKey, rollup] of aggregation.byTeam) {
    const flags = evaluateGroup(teamKey, 'team', rollup, riskStatuses.byTeam.get(teamKey), desWideExpectedAchievement, savedScenarios)
    if (flags.length > 0) flagsByGroup.set(teamKey, flags)
  }

  return flagsByGroup
}
