/**
 * S2-M2 acceptance-signal evidence: "team totals sum to their division's
 * total, and division totals sum to the DES-wide total, for a hand-checked
 * test case." Run with: npm run verify:aggregation
 */
import { aggregate } from '../src/system2/engine/aggregation'
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

// Hand-calculated by hand, independent of the code under test:
//   Design / Studio North: R1 (100 x 0.8 x 0.9 = 72) + R2 (50 x 1.0 x 1.0 = 50)
//     -> headcount 2, target 150, expected achievement 122
//   Design / Studio South: R3 (80 x 0.9 x 0.95 = 68.4)
//     -> headcount 1, target 80, expected achievement 68.4
//   Design total: headcount 3, target 230, expected achievement 190.4
//   Engineering / Platform: R4 (120 x 0.85 x 1.05 = 107.1)
//     -> headcount 1, target 120, expected achievement 107.1
//   Engineering total: headcount 1, target 120, expected achievement 107.1
//   DES-wide: headcount 4, target 350, expected achievement 297.5
const records: OrgRecord[] = [
  record({ id: 'R1', division: 'Design', team: 'Studio North', target: 100, capacityUtilisation: 0.8, teamHistoricalTrend: 0.9 }),
  record({ id: 'R2', division: 'Design', team: 'Studio North', target: 50, capacityUtilisation: 1.0, teamHistoricalTrend: 1.0 }),
  record({ id: 'R3', division: 'Design', team: 'Studio South', target: 80, capacityUtilisation: 0.9, teamHistoricalTrend: 0.95 }),
  record({ id: 'R4', division: 'Engineering', team: 'Platform', target: 120, capacityUtilisation: 0.85, teamHistoricalTrend: 1.05 }),
]

const result = aggregate(records)

let failures = 0
function check(label: string, actual: number, expected: number) {
  const close = Math.abs(actual - expected) < 1e-9
  console.log(`${label}: actual=${actual} expected=${expected} ${close ? 'OK' : 'FAIL'}`)
  if (!close) failures++
}

const studioNorth = result.byTeam.get('Design::Studio North')!
check('Studio North headcount', studioNorth.headcount, 2)
check('Studio North target', studioNorth.target, 150)
check('Studio North expected achievement', studioNorth.expectedAchievement, 122)

const studioSouth = result.byTeam.get('Design::Studio South')!
check('Studio South headcount', studioSouth.headcount, 1)
check('Studio South target', studioSouth.target, 80)
check('Studio South expected achievement', studioSouth.expectedAchievement, 68.4)

const platform = result.byTeam.get('Engineering::Platform')!
check('Platform headcount', platform.headcount, 1)
check('Platform target', platform.target, 120)
check('Platform expected achievement', platform.expectedAchievement, 107.1)

const design = result.byDivision.get('Design')!
check('Design headcount', design.headcount, 3)
check('Design target', design.target, 230)
check('Design expected achievement', design.expectedAchievement, 190.4)

const engineering = result.byDivision.get('Engineering')!
check('Engineering headcount', engineering.headcount, 1)
check('Engineering target', engineering.target, 120)
check('Engineering expected achievement', engineering.expectedAchievement, 107.1)

check('DES-wide headcount', result.desWide.headcount, 4)
check('DES-wide target', result.desWide.target, 350)
check('DES-wide expected achievement', result.desWide.expectedAchievement, 297.5)

// The acceptance signal itself, stated directly: sum the two team rollups
// and confirm they equal Design's own rollup; sum the two division rollups
// and confirm they equal the DES-wide rollup.
const teamsSummedToDesign = {
  headcount: studioNorth.headcount + studioSouth.headcount,
  target: studioNorth.target + studioSouth.target,
  expectedAchievement: studioNorth.expectedAchievement + studioSouth.expectedAchievement,
}
check('teams sum to Design (headcount)', teamsSummedToDesign.headcount, design.headcount)
check('teams sum to Design (target)', teamsSummedToDesign.target, design.target)
check('teams sum to Design (expected achievement)', teamsSummedToDesign.expectedAchievement, design.expectedAchievement)

const divisionsSummedToDesWide = {
  headcount: design.headcount + engineering.headcount,
  target: design.target + engineering.target,
  expectedAchievement: design.expectedAchievement + engineering.expectedAchievement,
}
check('divisions sum to DES-wide (headcount)', divisionsSummedToDesWide.headcount, result.desWide.headcount)
check('divisions sum to DES-wide (target)', divisionsSummedToDesWide.target, result.desWide.target)
check(
  'divisions sum to DES-wide (expected achievement)',
  divisionsSummedToDesWide.expectedAchievement,
  result.desWide.expectedAchievement,
)

console.log()
if (failures > 0) {
  console.error(`${failures} check(s) failed.`)
  process.exit(1)
}
console.log('All aggregation checks passed.')
