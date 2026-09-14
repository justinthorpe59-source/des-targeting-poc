/**
 * S2-M3 acceptance-signal evidence: "the same inputs always produce the same
 * risk status (deterministic)." Run with: npm run verify:risk-status
 */
import { aggregate } from '../src/system2/engine/aggregation'
import { assessRisk, computeRiskStatuses, isConcentrationRisk, simulateConfidence } from '../src/system2/engine/riskStatus'
import type { OrgRecord } from '../src/system2/data/types'

function record(overrides: Partial<OrgRecord> & { id: string }): OrgRecord {
  return {
    division: 'Design',
    team: 'Studio North',
    location: 'Boston',
    gradeCode: 3,
    roleTitle: 'Engineer',
    approvedAt: '2026-01-01T00:00:00.000Z',
    target: 0,
    capacityUtilisation: 1,
    teamHistoricalTrend: 1,
    ...overrides,
  }
}

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)} ${pass ? 'OK' : 'FAIL'}`)
  if (!pass) failures++
}

// --- Hand-built cases, one per status, isolating each threshold clause ---

// On track: ratio exactly 100%, confidence forced High via a seed key known
// (by trial) to roll High, no concentration.
const onTrackRecords = [
  record({ id: 'A1', target: 100, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
  record({ id: 'A2', target: 100, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
  record({ id: 'A3', target: 100, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
]
const onTrackRollup = { headcount: 3, target: 300, expectedAchievement: 300 }
{
  // Find a seed key that rolls High and one that rolls Low, deterministically,
  // rather than assuming - the PRNG is a black box from this script's side.
  let highKey = ''
  let lowKey = ''
  for (let i = 0; i < 1000 && (!highKey || !lowKey); i++) {
    const key = `probe-${i}`
    const c = simulateConfidence(key)
    if (c === 'High' && !highKey) highKey = key
    if (c === 'Low' && !lowKey) lowKey = key
  }

  const onTrack = assessRisk(onTrackRollup, onTrackRecords, highKey)
  check('On track: ratio', onTrack.forecastRatio, 1)
  check('On track: confidence', onTrack.confidence, 'High')
  check('On track: concentration', onTrack.concentrationFlagged, false)
  check('On track: status', onTrack.status, 'On track')

  // Same rollup/records/goal, confidence forced Low via seed -> At risk, not On track.
  const lowConfidence = assessRisk(onTrackRollup, onTrackRecords, lowKey)
  check('High ratio + Low confidence: status', lowConfidence.status, 'At risk')
}

// At risk: ratio 90-100%.
const atRiskRollup = { headcount: 1, target: 100, expectedAchievement: 95 }
const atRiskRecords = [record({ id: 'B1', target: 100, capacityUtilisation: 0.95, teamHistoricalTrend: 1 })]
{
  const atRisk = assessRisk(atRiskRollup, atRiskRecords, 'at-risk-seed')
  check('At risk: ratio', Math.round(atRisk.forecastRatio * 100) / 100, 0.95)
  check('At risk: status', atRisk.status, 'At risk')
}

// Off track: ratio <90%, even forced through a High-confidence, non-concentrated seed.
const offTrackRollup = { headcount: 1, target: 100, expectedAchievement: 80 }
const offTrackRecords = [record({ id: 'C1', target: 100, capacityUtilisation: 0.8, teamHistoricalTrend: 1 })]
{
  let highKey = ''
  for (let i = 0; i < 1000 && !highKey; i++) {
    if (simulateConfidence(`probe-${i}`) === 'High') highKey = `probe-${i}`
  }
  const offTrack = assessRisk(offTrackRollup, offTrackRecords, highKey)
  check('Off track: ratio', offTrack.forecastRatio, 0.8)
  check('Off track: status (overrides High confidence)', offTrack.status, 'Off track')
}

// Infeasible: even max feasible capacity (1.05) across every record can't reach the goal.
const infeasibleRecords = [
  record({ id: 'D1', target: 100, capacityUtilisation: 0.75, teamHistoricalTrend: 1 }),
  record({ id: 'D2', target: 100, capacityUtilisation: 0.75, teamHistoricalTrend: 1 }),
]
// Max feasible = (100*1.05*1) + (100*1.05*1) = 210. Goal set above that.
const infeasibleRollup = aggregate(infeasibleRecords).desWide
{
  const infeasible = assessRisk(infeasibleRollup, infeasibleRecords, 'infeasible-seed', 250)
  check('Infeasible: status', infeasible.status, 'Infeasible')

  // Boundary: goal exactly at max feasible (210) should NOT be Infeasible.
  const atBoundary = assessRisk(infeasibleRollup, infeasibleRecords, 'infeasible-seed', 210)
  check('Infeasible boundary (goal == max feasible): status is not Infeasible', atBoundary.status !== 'Infeasible', true)
}

// Concentration risk: 5-person team, one person contributes the overwhelming majority.
const concentrationRecords = [
  record({ id: 'E1', target: 1000, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
  record({ id: 'E2', target: 10, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
  record({ id: 'E3', target: 10, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
  record({ id: 'E4', target: 10, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
  record({ id: 'E5', target: 10, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
]
{
  check('Concentration: flagged for a dominated 5-person group', isConcentrationRisk(concentrationRecords), true)

  const evenlySpread = [
    record({ id: 'F1', target: 100, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
    record({ id: 'F2', target: 100, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
    record({ id: 'F3', target: 100, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
    record({ id: 'F4', target: 100, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
    record({ id: 'F5', target: 100, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
  ]
  check('Concentration: not flagged for an evenly-spread 5-person group', isConcentrationRisk(evenlySpread), false)

  const tinyDominated = [
    record({ id: 'G1', target: 1000, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
    record({ id: 'G2', target: 10, capacityUtilisation: 1, teamHistoricalTrend: 1 }),
  ]
  check('Concentration: not flagged below the minimum headcount, even if dominated', isConcentrationRisk(tinyDominated), false)

  // A concentration flag alone (ratio otherwise on-track) should still yield At risk.
  const concentratedButHighRatio = [
    record({ id: 'H1', target: 100, capacityUtilisation: 1.05, teamHistoricalTrend: 1 }),
    record({ id: 'H2', target: 1, capacityUtilisation: 1.05, teamHistoricalTrend: 1 }),
    record({ id: 'H3', target: 1, capacityUtilisation: 1.05, teamHistoricalTrend: 1 }),
  ]
  const rollup = aggregate(concentratedButHighRatio).desWide
  let highKey = ''
  for (let i = 0; i < 1000 && !highKey; i++) {
    if (simulateConfidence(`probe-${i}`) === 'High') highKey = `probe-${i}`
  }
  const assessment = assessRisk(rollup, concentratedButHighRatio, highKey, rollup.target)
  check('Concentration flagged despite ratio >=100% and High confidence', assessment.concentrationFlagged, true)
  check('Concentration alone forces At risk, not On track', assessment.status, 'At risk')
}

// --- computeRiskStatuses: full group wiring, using S2-M2's own hand-built case ---
const s2m2Records = [
  record({ id: 'R1', division: 'Design', team: 'Studio North', target: 100, capacityUtilisation: 0.8, teamHistoricalTrend: 0.9 }),
  record({ id: 'R2', division: 'Design', team: 'Studio North', target: 50, capacityUtilisation: 1.0, teamHistoricalTrend: 1.0 }),
  record({ id: 'R3', division: 'Design', team: 'Studio South', target: 80, capacityUtilisation: 0.9, teamHistoricalTrend: 0.95 }),
  record({ id: 'R4', division: 'Engineering', team: 'Platform', target: 120, capacityUtilisation: 0.85, teamHistoricalTrend: 1.05 }),
]
const s2m2Aggregation = aggregate(s2m2Records)
const results = computeRiskStatuses(s2m2Records, s2m2Aggregation)
check('computeRiskStatuses: has a status for every division', results.byDivision.size, s2m2Aggregation.byDivision.size)
check('computeRiskStatuses: has a status for every team', results.byTeam.size, s2m2Aggregation.byTeam.size)
check(
  'computeRiskStatuses: Studio North ratio matches its own rollup (122/150)',
  Math.round((results.byTeam.get('Design::Studio North')!.forecastRatio) * 1e6) / 1e6,
  Math.round((122 / 150) * 1e6) / 1e6,
)

// --- Determinism: the acceptance signal itself, stated directly ---
// Rerun the full pipeline from the same inputs, fresh objects each time
// (new arrays, new aggregation call), and require byte-identical results -
// not just "looks the same", an actual deep-equality check.
function runPipeline() {
  const records = [
    record({ id: 'R1', division: 'Design', team: 'Studio North', target: 100, capacityUtilisation: 0.8, teamHistoricalTrend: 0.9 }),
    record({ id: 'R2', division: 'Design', team: 'Studio North', target: 50, capacityUtilisation: 1.0, teamHistoricalTrend: 1.0 }),
    record({ id: 'R3', division: 'Design', team: 'Studio South', target: 80, capacityUtilisation: 0.9, teamHistoricalTrend: 0.95 }),
    record({ id: 'R4', division: 'Engineering', team: 'Platform', target: 120, capacityUtilisation: 0.85, teamHistoricalTrend: 1.05 }),
  ]
  const agg = aggregate(records)
  return computeRiskStatuses(records, agg)
}

function serialise(result: ReturnType<typeof runPipeline>) {
  return JSON.stringify({
    desWide: result.desWide,
    byDivision: [...result.byDivision.entries()],
    byTeam: [...result.byTeam.entries()],
  })
}

const run1 = serialise(runPipeline())
const run2 = serialise(runPipeline())
const run3 = serialise(runPipeline())
console.log()
console.log('determinism run 1:', run1)
console.log('determinism run 2:', run2)
console.log('determinism run 3:', run3)
check('determinism: run1 === run2', run1 === run2, true)
check('determinism: run2 === run3', run2 === run3, true)

console.log()
if (failures > 0) {
  console.error(`${failures} check(s) failed.`)
  process.exit(1)
}
console.log('All risk status checks passed.')
