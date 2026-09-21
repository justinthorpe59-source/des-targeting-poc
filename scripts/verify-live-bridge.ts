/**
 * Batch 3a acceptance-signal evidence: the read-only bridge returns System
 * 2's actual computed team/division/org state (not a re-derived, possibly-
 * drifting copy), degrades gracefully to null/empty when System 2 has no
 * data yet, and never hands out a mutable reference to System 2's records.
 * Run with: npm run verify:live-bridge
 */
import {
  computeSystem2LiveSnapshot,
  getDivisionLiveState,
  getOrgLiveState,
  getTeamLiveState,
} from '../src/system2/bridge/liveOrgState'
import { aggregate } from '../src/system2/engine/aggregation'
import { computeRiskStatuses } from '../src/system2/engine/riskStatus'
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

// Same hand-calculated case as verify-aggregation.ts, reused deliberately —
// if the bridge's numbers agree with that already-verified case, they agree
// with System 2's actual engine, not a second implementation of it.
//   Design / Studio North: R1 (100 x 0.8 x 0.9 = 72) + R2 (50 x 1.0 x 1.0 = 50)
//     -> headcount 2, target 150, expected achievement 122
//   Design / Studio South: R3 (80 x 0.9 x 0.95 = 68.4)
//     -> headcount 1, target 80, expected achievement 68.4
//   Engineering / Platform: R4 (120 x 0.85 x 1.05 = 107.1)
//     -> headcount 1, target 120, expected achievement 107.1
//   DES-wide: headcount 4, target 350, expected achievement 297.5
const records: OrgRecord[] = [
  record({ id: 'R1', division: 'Design', team: 'Studio North', target: 100, capacityUtilisation: 0.8, teamHistoricalTrend: 0.9 }),
  record({ id: 'R2', division: 'Design', team: 'Studio North', target: 50, capacityUtilisation: 1.0, teamHistoricalTrend: 1.0 }),
  record({ id: 'R3', division: 'Design', team: 'Studio South', target: 80, capacityUtilisation: 0.9, teamHistoricalTrend: 0.95 }),
  record({ id: 'R4', division: 'Engineering', team: 'Platform', target: 120, capacityUtilisation: 0.85, teamHistoricalTrend: 1.05 }),
]

console.log('--- Part 1: empty state degrades gracefully ---')
{
  const empty = computeSystem2LiveSnapshot([], null)
  check('hasData is false', empty.hasData, false)
  check('org is null', getOrgLiveState(empty), null)
  check('team lookup is null', getTeamLiveState(empty, 'Design', 'Studio North'), null)
  check('division lookup is null', getDivisionLiveState(empty, 'Design'), null)
  check('records is an empty array, not undefined/throwing', empty.records, [])
}

console.log()
console.log('--- Part 2: bridge values match System 2\'s own engine on the same records ---')
{
  const snapshot = computeSystem2LiveSnapshot(records, '2026-01-01T00:00:00.000Z')
  const directAggregation = aggregate(records)
  const directRiskStatuses = computeRiskStatuses(records, directAggregation)

  check('hasData is true', snapshot.hasData, true)

  const org = getOrgLiveState(snapshot)
  check('org goal matches aggregate()\'s own DES-wide target', org?.goal, directAggregation.desWide.target)
  check('org rollup matches aggregate() directly', org?.rollup, directAggregation.desWide)
  check('org risk matches computeRiskStatuses() directly', org?.risk, directRiskStatuses.desWide)

  const studioNorth = getTeamLiveState(snapshot, 'Design', 'Studio North')
  check('Studio North headcount', studioNorth?.rollup.headcount, 2)
  check('Studio North target', studioNorth?.rollup.target, 150)
  check('Studio North expected achievement', studioNorth?.rollup.expectedAchievement, 122)
  check('Studio North risk matches computeRiskStatuses() directly', studioNorth?.risk, directRiskStatuses.byTeam.get('Design::Studio North'))
  check('Studio North exposes exactly its own 2 records', studioNorth?.records.map((r) => r.id).sort(), ['R1', 'R2'])

  const design = getDivisionLiveState(snapshot, 'Design')
  check('Design headcount', design?.rollup.headcount, 3)
  check('Design target', design?.rollup.target, 230)
  check('Design expected achievement matches aggregate() directly', design?.rollup.expectedAchievement, directAggregation.byDivision.get('Design')?.expectedAchievement)
  check('Design exposes exactly its own 3 records', design?.records.map((r) => r.id).sort(), ['R1', 'R2', 'R3'])

  check('a team with no records in this snapshot returns null, not an empty rollup', getTeamLiveState(snapshot, 'Science', 'Research'), null)
  check('a division with no records in this snapshot returns null', getDivisionLiveState(snapshot, 'Science'), null)
}

console.log()
console.log('--- Part 3: the bridge is genuinely read-only ---')
{
  const snapshot = computeSystem2LiveSnapshot(records, null)
  let threw = false
  try {
    // @ts-expect-error deliberately attempting a mutation the type system already forbids, to prove it's also forbidden at runtime
    snapshot.records[0].target = 999999
  } catch {
    threw = true
  }
  check('mutating a returned record throws (frozen, not just typed readonly)', threw, true)
  check('the underlying records array is untouched by the mutation attempt', snapshot.records[0].target, records.find((r) => r.id === snapshot.records[0].id)?.target)

  let arrayThrew = false
  try {
    // @ts-expect-error same — the array itself is frozen too
    snapshot.records.push(record({ id: 'INTRUDER' }))
  } catch {
    arrayThrew = true
  }
  check('pushing onto the returned records array throws', arrayThrew, true)
}

console.log()
console.log('--- Part 4: determinism — same records in, same snapshot out ---')
{
  const run1 = JSON.stringify(computeSystem2LiveSnapshot(records, 'x'))
  const run2 = JSON.stringify(computeSystem2LiveSnapshot(records, 'x'))
  check('two independent calls produce byte-identical snapshots', run1 === run2, true)
}

console.log()
if (failures > 0) {
  console.error(`${failures} check(s) failed.`)
  process.exit(1)
}
console.log('All live-bridge checks passed.')
