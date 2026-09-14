import type { Division } from '../../system1/data/types'
import type { OrgRecord } from '../data/types'

/**
 * S2-M2: rollups by team/division/DES-wide. Locked formula: expected
 * achievement = target x (capacity utilisation x team historical trend).
 *
 * Sums are accumulated in raw (unrounded) form at every level, same
 * precedent as M2's targeting engine keeping a `raw` value alongside a
 * rounded display figure — rounding each person's expected achievement
 * before summing is exactly what would make "team totals sum to division
 * total" fail by cumulative rounding drift. Round only at display time,
 * never inside this file.
 */

export interface Rollup {
  headcount: number
  target: number
  expectedAchievement: number
}

export interface AggregationResult {
  desWide: Rollup
  byDivision: Map<Division, Rollup>
  /** Keyed "division::team" — team names repeat across divisions (same convention as the M6 cohort-averaging code). */
  byTeam: Map<string, Rollup>
}

function expectedAchievementFor(record: OrgRecord): number {
  return record.target * record.capacityUtilisation * record.teamHistoricalTrend
}

function emptyRollup(): Rollup {
  return { headcount: 0, target: 0, expectedAchievement: 0 }
}

function addRecord(rollup: Rollup, record: OrgRecord): Rollup {
  return {
    headcount: rollup.headcount + 1,
    target: rollup.target + record.target,
    expectedAchievement: rollup.expectedAchievement + expectedAchievementFor(record),
  }
}

export function aggregate(records: OrgRecord[]): AggregationResult {
  let desWide = emptyRollup()
  const byDivision = new Map<Division, Rollup>()
  const byTeam = new Map<string, Rollup>()

  for (const record of records) {
    desWide = addRecord(desWide, record)
    byDivision.set(record.division, addRecord(byDivision.get(record.division) ?? emptyRollup(), record))
    const teamKey = `${record.division}::${record.team}`
    byTeam.set(teamKey, addRecord(byTeam.get(teamKey) ?? emptyRollup(), record))
  }

  return { desWide, byDivision, byTeam }
}
