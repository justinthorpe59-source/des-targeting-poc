/**
 * S2-M9 acceptance-signal evidence: detectRiskExceptions() must catch
 * exactly the groups that violate a locked threshold - verified against a
 * hand-built test case with a known answer, not the incidental output of a
 * real snapshot. Run with: npm run verify:risk-exceptions
 *
 * Most inputs are hand-constructed AggregationResult/RiskStatusResult
 * objects rather than run through the real engine, so every figure here is
 * exactly chosen, not dependent on the seeded confidence simulation landing
 * on a particular value. The regression test at the bottom is the
 * exception - it deliberately goes through the REAL aggregate()/
 * computeRiskStatuses() pipeline, because the bug it guards against (see
 * below) lives in how aggregate() sums records, which a hand-built
 * AggregationResult can't exercise.
 */
import { aggregate } from '../src/system2/engine/aggregation'
import { computeRiskStatuses } from '../src/system2/engine/riskStatus'
import { computeGoals } from '../src/system2/engine/goals'
import { detectRiskExceptions } from '../src/system2/engine/riskExceptions'
import type { AggregationResult, Rollup } from '../src/system2/engine/aggregation'
import type { RiskAssessment, RiskStatusResult } from '../src/system2/engine/riskStatus'
import type { OrgRecord } from '../src/system2/data/types'
import type { SavedScenario } from '../src/store/scenarioStore'
import type { Division } from '../src/system1/data/types'

function rollup(expectedAchievement: number, target = 100, headcount = 1): Rollup {
  return { headcount, target, expectedAchievement }
}

function risk(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
  return { forecastRatio: 1, confidence: 'High', concentrationFlagged: false, status: 'On track', ...overrides }
}

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)} ${pass ? 'OK' : 'FAIL'}`)
  if (!pass) failures++
}

// ============================================================================
// Part 1: hand-built AggregationResult/RiskStatusResult, one isolated case
// per threshold type, both boundaries, a missing-data sub-case, and a
// co-occurrence case.
//
// detectRiskExceptions() computes its reliance-share denominator as the sum
// of only the FINITE byTeam expectedAchievement values (not
// aggregation.desWide.expectedAchievement directly - see the bug note on
// sanitizedDesWideExpectedAchievement() in riskExceptions.ts). So every
// team's expectedAchievement below is chosen so that sum comes out to
// exactly 1000, making the reliance-share percentages exact round numbers.
// ============================================================================

const byDivision = new Map<Division, Rollup>([
  ['Design', rollup(500, 600)], // isolated Infeasible: ratio 0.83 (>=0.8, not also a gap), High confidence (not also high-reliance)
  ['Engineering', rollup(200, 300)], // missing-forecast-data: present in aggregation, no entry in riskStatuses.byDivision
  ['Science', rollup(100, 100)], // clean negative control
])

const riskByDivision = new Map<Division, RiskAssessment>([
  ['Design', risk({ status: 'Infeasible', forecastRatio: 0.83, confidence: 'High' })],
  ['Science', risk({ status: 'On track', forecastRatio: 1.0, confidence: 'High' })],
  // 'Engineering' deliberately absent.
])

const byTeam = new Map<string, Rollup>([
  // High-reliance boundary: 31.0% (flag) vs exactly 30.0% (no flag - the
  // locked threshold is ">30%", not ">=30%"), against a total of 1000.
  ['Design::HighReliance31', rollup(310)],
  ['Design::HighReliance30', rollup(300)],
  // Large-gap boundary: ratio 0.79 (flag) vs exactly 0.80 (no flag - the
  // locked threshold is ">20% below", i.e. ratio <0.8, not <=0.8).
  ['Engineering::LargeGap79', rollup(50)],
  ['Engineering::LargeGap80', rollup(50)],
  // Large gap, but a saved scenario's capacity lever targets this exact
  // team - "tested", so no flag despite the same ratio as LargeGap79.
  ['Science::TestedGap', rollup(50)],
  // Missing-forecast-data via a team PRESENT in the map but with NaN
  // fields (the "present but malformed" sub-case, vs Engineering's
  // "absent entirely" sub-case above). Excluded from the reliance
  // denominator by construction (Number.isFinite check).
  ['Science::MissingRatio', rollup(NaN)],
  // Co-occurrence: Infeasible AND a large gap on the same group at once -
  // the two checks are independent and can both fire.
  ['Design::InfeasibleAndGap', rollup(50)],
  // Filler so the finite team total is exactly 1000 (310+300+50+50+50+50+190).
  ['Design::CleanFiller', rollup(190)],
])

const riskByTeam = new Map<string, RiskAssessment>([
  ['Design::HighReliance31', risk({ status: 'At risk', forecastRatio: 0.9, confidence: 'Low' })],
  ['Design::HighReliance30', risk({ status: 'At risk', forecastRatio: 0.9, confidence: 'Low' })],
  ['Engineering::LargeGap79', risk({ status: 'Off track', forecastRatio: 0.79, confidence: 'High' })],
  ['Engineering::LargeGap80', risk({ status: 'At risk', forecastRatio: 0.8, confidence: 'High' })],
  ['Science::TestedGap', risk({ status: 'Off track', forecastRatio: 0.5, confidence: 'High' })],
  ['Science::MissingRatio', risk({ status: 'On track', forecastRatio: NaN, confidence: 'High' })],
  ['Design::InfeasibleAndGap', risk({ status: 'Infeasible', forecastRatio: 0.5, confidence: 'High' })],
  ['Design::CleanFiller', risk({ status: 'On track', forecastRatio: 1.0, confidence: 'High' })],
])

const aggregation: AggregationResult = { desWide: rollup(NaN, NaN, 0), byDivision, byTeam }
const riskStatuses: RiskStatusResult = { desWide: risk(), byDivision: riskByDivision, byTeam: riskByTeam }

const savedScenarios: SavedScenario[] = [
  {
    id: 's1',
    name: 'Tested Science::TestedGap',
    savedAt: '2026-01-01T00:00:00.000Z',
    levers: { capacityChange: { scope: { level: 'team', division: 'Science', team: 'TestedGap' }, multiplier: 1.1 } },
  },
  {
    id: 's2',
    name: 'Unrelated override, should not suppress anything else',
    savedAt: '2026-01-01T00:00:00.000Z',
    levers: { groupOverride: { target: { level: 'division', division: 'Design' }, expectedAchievement: 999 } },
  },
]

const expected: Record<string, string[]> = {
  Design: ['infeasible'],
  Engineering: ['missing-forecast-data'],
  Science: [],
  'Design::HighReliance31': ['low-confidence-high-reliance'],
  'Design::HighReliance30': [],
  'Engineering::LargeGap79': ['large-unexplained-gap'],
  'Engineering::LargeGap80': [],
  'Science::TestedGap': [],
  'Science::MissingRatio': ['missing-forecast-data'],
  'Design::InfeasibleAndGap': ['infeasible', 'large-unexplained-gap'],
  'Design::CleanFiller': [],
}

const result = detectRiskExceptions({ aggregation, riskStatuses, savedScenarios })

for (const [groupKey, expectedTypes] of Object.entries(expected)) {
  const actualFlags = result.get(groupKey) ?? []
  const actualTypes = actualFlags.map((f) => f.type).sort()
  const expectedSorted = [...expectedTypes].sort()
  const match = JSON.stringify(actualTypes) === JSON.stringify(expectedSorted)
  console.log(`${groupKey}: expected [${expectedSorted.join(', ')}] actual [${actualTypes.join(', ')}] ${match ? 'OK' : 'MISMATCH'}`)
  if (!match) failures++
}

for (const groupKey of result.keys()) {
  if (!(groupKey in expected)) {
    console.log(`${groupKey}: UNEXPECTED - flagged but not in the expected set at all`)
    failures++
  }
}

console.log()
console.log(`Part 1 total flagged groups (expected 6 of 11): ${result.size}`)

// ============================================================================
// Part 2: regression test for the NaN-poisoning bug found by playwright-mcp
// verification (not caught by Part 1, above, because a hand-built
// AggregationResult never goes through aggregate()'s summation at all).
//
// Bug: aggregate() sums every record's expected achievement into ONE
// desWide.expectedAchievement total with no isolation - a single malformed
// record anywhere poisoned the whole DES-wide total, and detectRiskExceptions
// used to read that value directly as its reliance-share denominator. Once
// poisoned, `desWideExpectedAchievement > 0` is false for NaN, so the
// low-confidence-high-reliance check silently stopped firing for every
// OTHER group in the dataset too, not just the corrupted one.
//
// Fix: the denominator is now the sum of only the FINITE byTeam rollups
// (sanitizedDesWideExpectedAchievement in riskExceptions.ts), so a corrupted
// team/division still gets its own missing-forecast-data flag, but no
// longer silently disables a correct flag anywhere else.
// ============================================================================
console.log()
console.log('--- Part 2: NaN-poisoning regression ---')
{
  const records: OrgRecord[] = [
    // 'Engineering' division confidence is deterministically Low
    // (simulateConfidence('Engineering')). Target dominates the total so
    // its reliance share is unambiguously >30% regardless of the random
    // capacity/trend factors.
    {
      id: 'E1',
      division: 'Engineering',
      team: 'Platform',
      location: 'Boston',
      gradeCode: 3,
      roleTitle: 'Engineer',
      target: 1000,
      approvedAt: '',
      capacityUtilisation: 0.9,
      teamHistoricalTrend: 1,
    },
    {
      id: 'D1',
      division: 'Design',
      team: 'Studio North',
      location: 'Boston',
      gradeCode: 3,
      roleTitle: 'Engineer',
      target: 50,
      approvedAt: '',
      capacityUtilisation: 1,
      teamHistoricalTrend: 1,
    },
    // Corrupted record in a third, unrelated division/team.
    {
      id: 'CORRUPT',
      division: 'Science',
      team: 'Research',
      location: 'Boston',
      gradeCode: 3,
      roleTitle: 'Engineer',
      target: 50,
      approvedAt: '',
      capacityUtilisation: NaN,
      teamHistoricalTrend: 1,
    },
  ]

  const realAggregation = aggregate(records)
  const realRiskStatuses = computeRiskStatuses(records, realAggregation, computeGoals(realAggregation))
  const realResult = detectRiskExceptions({ aggregation: realAggregation, riskStatuses: realRiskStatuses, savedScenarios: [] })

  check(
    'sanity check: the real DES-wide total IS poisoned by the corrupted record',
    Number.isFinite(realAggregation.desWide.expectedAchievement),
    false,
  )
  check(
    'Engineering (dominant share, genuinely Low confidence) is STILL flagged low-confidence-high-reliance despite the poisoned DES-wide total',
    (realResult.get('Engineering') ?? []).map((f) => f.type).includes('low-confidence-high-reliance'),
    true,
  )
  check(
    'the corrupted group itself is flagged missing-forecast-data',
    (realResult.get('Science::Research') ?? []).map((f) => f.type),
    ['missing-forecast-data'],
  )
}

console.log()
if (failures > 0) {
  console.error(`${failures} mismatch(es)/failure(s).`)
  process.exit(1)
}
console.log('All checks passed.')
