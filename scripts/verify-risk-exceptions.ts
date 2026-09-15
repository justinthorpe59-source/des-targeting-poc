/**
 * S2-M9 acceptance-signal evidence: detectRiskExceptions() must catch
 * exactly the groups that violate a locked threshold — verified against a
 * hand-built test case with a known answer, not the incidental output of a
 * real snapshot. Run with: npm run verify:risk-exceptions
 *
 * Inputs are hand-constructed AggregationResult/RiskStatusResult objects
 * rather than run through the real engine, so every figure here is exactly
 * chosen, not dependent on the seeded confidence simulation landing on a
 * particular value.
 */
import { detectRiskExceptions } from '../src/system2/engine/riskExceptions'
import type { AggregationResult, Rollup } from '../src/system2/engine/aggregation'
import type { RiskAssessment, RiskStatusResult } from '../src/system2/engine/riskStatus'
import type { SavedScenario } from '../src/store/scenarioStore'
import type { Division } from '../src/system1/data/types'

function rollup(expectedAchievement: number, target = 100, headcount = 1): Rollup {
  return { headcount, target, expectedAchievement }
}

function risk(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
  return { forecastRatio: 1, confidence: 'High', concentrationFlagged: false, status: 'On track', ...overrides }
}

// DES-wide expected achievement fixed at 1000, so a group's "share" is just
// its own expectedAchievement / 10, in percent — easy to hand-verify.
const desWide = rollup(1000, 1000, 10)

const byDivision = new Map<Division, Rollup>([
  // Isolated Infeasible: ratio 0.83 (>=0.8, not also a gap) and High
  // confidence (not also high-reliance).
  ['Design', rollup(500, 600)],
  // Missing-forecast-data via a division present in aggregation but with
  // NO entry at all in riskStatuses.byDivision.
  ['Engineering', rollup(200, 300)],
  // Clean negative control.
  ['Science', rollup(100, 100)],
])

const riskByDivision = new Map<Division, RiskAssessment>([
  ['Design', risk({ status: 'Infeasible', forecastRatio: 0.83, confidence: 'High' })],
  ['Science', risk({ status: 'On track', forecastRatio: 1.0, confidence: 'High' })],
  // 'Engineering' deliberately absent.
])

const byTeam = new Map<string, Rollup>([
  // High-reliance boundary: 31% (flag) vs exactly 30% (no flag - the
  // locked threshold is ">30%", not ">=30%").
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
  // "absent entirely" sub-case above).
  ['Science::MissingRatio', rollup(NaN)],
  // Co-occurrence: Infeasible AND a large gap on the same group at once -
  // the two checks are independent and can both fire.
  ['Design::InfeasibleAndGap', rollup(50)],
])

const riskByTeam = new Map<string, RiskAssessment>([
  ['Design::HighReliance31', risk({ status: 'At risk', forecastRatio: 0.9, confidence: 'Low' })],
  ['Design::HighReliance30', risk({ status: 'At risk', forecastRatio: 0.9, confidence: 'Low' })],
  ['Engineering::LargeGap79', risk({ status: 'Off track', forecastRatio: 0.79, confidence: 'High' })],
  ['Engineering::LargeGap80', risk({ status: 'At risk', forecastRatio: 0.8, confidence: 'High' })],
  ['Science::TestedGap', risk({ status: 'Off track', forecastRatio: 0.5, confidence: 'High' })],
  ['Science::MissingRatio', risk({ status: 'On track', forecastRatio: NaN, confidence: 'High' })],
  ['Design::InfeasibleAndGap', risk({ status: 'Infeasible', forecastRatio: 0.5, confidence: 'High' })],
])

const aggregation: AggregationResult = { desWide, byDivision, byTeam }
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
}

const result = detectRiskExceptions({ aggregation, riskStatuses, savedScenarios })

let failures = 0
for (const [groupKey, expectedTypes] of Object.entries(expected)) {
  const actualFlags = result.get(groupKey) ?? []
  const actualTypes = actualFlags.map((f) => f.type).sort()
  const expectedSorted = [...expectedTypes].sort()
  const match = JSON.stringify(actualTypes) === JSON.stringify(expectedSorted)
  console.log(`${groupKey}: expected [${expectedSorted.join(', ')}] actual [${actualTypes.join(', ')}] ${match ? 'OK' : 'MISMATCH'}`)
  if (!match) failures++
}

// Also check nothing outside the expected set got flagged.
for (const groupKey of result.keys()) {
  if (!(groupKey in expected)) {
    console.log(`${groupKey}: UNEXPECTED - flagged but not in the expected set at all`)
    failures++
  }
}

console.log()
console.log(`Total flagged groups (expected 6 of 10): ${result.size}`)

if (failures > 0) {
  console.error(`${failures} mismatch(es).`)
  process.exit(1)
}
console.log('All 10 groups matched their expected exception set exactly.')
