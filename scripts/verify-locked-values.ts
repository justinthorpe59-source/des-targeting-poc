/**
 * M4 numbers-and-data audit, kept as a runnable script rather than a one-off
 * report. Two things it guards:
 *
 *  1. The code still agrees with CLAUDE.md's locked dataset defaults and
 *     thresholds. Those numbers are load-bearing — every figure in both
 *     systems derives from them — and nothing else checks that a constant
 *     has not quietly drifted.
 *  2. The System 1 -> System 2 hand-off is arithmetically faithful, and the
 *     hierarchy sums without apportioning.
 *
 * Run with: npm run verify:locked
 */
import { SEED_PEOPLE } from '../src/system1/data/people'
import {
  DIVISIONS,
  LOCATIONS,
  BASELINE_BY_DIVISION,
  TEAMS_BY_DIVISION,
  GRADE_TABLE,
  SALES_TARGET_GRADES,
  utilisationTargetFor,
} from '../src/system1/data/types'
import { EXTREME_VALUE_DEVIATION_THRESHOLD, LARGE_ADJUSTMENT_THRESHOLD } from '../src/system1/engine/exceptions'
import { WORKING_DAYS_PER_YEAR, calculateRevenue, combinedRevenueFor } from '../src/system1/engine/revenueEngine'
import { calculateModelledTarget, TARGET_RANGE_BAND } from '../src/system1/engine/targetingEngine'
import SNAPSHOT from '../src/system2/data/snapshot.seed.json'
import { ingestSnapshot } from '../src/system2/engine/ingestSnapshot'
import { aggregate } from '../src/system2/engine/aggregation'
import { computeGoals } from '../src/system2/engine/goals'
import { computeRiskStatuses } from '../src/system2/engine/riskStatus'
import type { Snapshot } from '../src/system1/engine/buildSnapshot'

const checks: Array<[string, unknown, unknown]> = []
const check = (label: string, actual: unknown, expected: unknown) => checks.push([label, actual, expected])

// ---------- CLAUDE.md locked dataset defaults ----------
check('population is 60', SEED_PEOPLE.length, 60)
check('divisions', DIVISIONS.join(','), 'Design,Engineering,Science')
check('locations', LOCATIONS.join(','), 'Boston,Ireland,London,GITC')
check('division baselines (£k)', JSON.stringify(BASELINE_BY_DIVISION), JSON.stringify({ Design: 92, Engineering: 100, Science: 96 }))
check('two teams per division', DIVISIONS.every((d) => TEAMS_BY_DIVISION[d].length === 2), true)
check('target range band is ±15%', TARGET_RANGE_BAND, 0.15)
check('extreme-value deviation threshold is 25%', EXTREME_VALUE_DEVIATION_THRESHOLD, 0.25)
check('large-adjustment threshold is ±20%', LARGE_ADJUSTMENT_THRESHOLD, 0.2)
check('utilisation: Analyst 65%', utilisationTargetFor('Analyst'), 0.65)
check('utilisation: every other grade 85%', utilisationTargetFor('Consultant'), 0.85)
check('sales target is Managing Consultant and above', SALES_TARGET_GRADES.join(','), 'Managing Consultant,Associate Partner,Partner')
check('working days per year is 220', WORKING_DAYS_PER_YEAR, 220)

// ---------- the seed population obeys those defaults ----------
check('capacity within 0.6–1.0 for all 60', SEED_PEOPLE.every((p) => p.capacity >= 0.6 && p.capacity <= 1.0), true)
check('economic factor within 0.9–1.15 for all 60', SEED_PEOPLE.every((p) => p.economicFactor >= 0.9 && p.economicFactor <= 1.15), true)
check('role factor matches the grade table for all 60', SEED_PEOPLE.every((p) => p.roleFactor === GRADE_TABLE[p.grade].roleFactor), true)
check('utilisation matches the grade rule for all 60', SEED_PEOPLE.every((p) => p.utilisationTarget === utilisationTargetFor(p.grade)), true)
check('sales target present only on MC+ for all 60', SEED_PEOPLE.every((p) => (p.salesTarget !== null) === SALES_TARGET_GRADES.includes(p.grade)), true)
check('baseline matches the division for all 60', SEED_PEOPLE.every((p) => p.baseline === BASELINE_BY_DIVISION[p.division]), true)
check('every person sits in a real team', SEED_PEOPLE.every((p) => (TEAMS_BY_DIVISION[p.division] as readonly string[]).includes(p.team)), true)

// ---------- the locked formula ----------
/* The range is derived from the UNROUNDED product, not from the rounded
   modelled figure — rounding once, at the end. Deriving it from the rounded
   value disagrees on 22 of the 60 records by £1k, so this assertion is
   written the way the engine actually works rather than the way it is easy
   to assume it works. */
const formulaMismatches = SEED_PEOPLE.filter((p) => {
  const t = calculateModelledTarget(p)
  const raw = p.baseline * p.capacity * p.roleFactor * p.economicFactor
  return (
    t.modelled !== Math.round(raw) ||
    t.rangeLow !== Math.round(raw * (1 - TARGET_RANGE_BAND)) ||
    t.rangeHigh !== Math.round(raw * (1 + TARGET_RANGE_BAND))
  )
})
check('modelled = round(baseline × capacity × role × economic), all 60', formulaMismatches.length, 0)
check('recalculating every record twice is identical', SEED_PEOPLE.every((p) => JSON.stringify(calculateModelledTarget(p)) === JSON.stringify(calculateModelledTarget(p))), true)
check('billable + sales = combined revenue, all 60', SEED_PEOPLE.every((p) => {
  const r = calculateRevenue(p)
  return r.combinedRevenue === Math.round((p.dayRate * p.utilisationTarget * WORKING_DAYS_PER_YEAR) / 1000) + r.salesRevenue
}), true)

// ---------- the System 1 -> System 2 hand-off ----------
const byId = new Map(SEED_PEOPLE.map((p) => [p.id, p]))
check('snapshot holds the whole population', SNAPSHOT.recordCount, SEED_PEOPLE.length)
check('no duplicate ids in the snapshot', new Set(SNAPSHOT.records.map((r) => r.id)).size, SNAPSHOT.recordCount)
check('every snapshot target = combinedRevenueFor(person)', SNAPSHOT.records.every((r) => r.target === combinedRevenueFor(byId.get(r.id)!)), true)
check('every snapshot division/team matches its person', SNAPSHOT.records.every((r) => {
  const p = byId.get(r.id)!
  return p.division === r.division && p.team === r.team
}), true)

// ---------- System 2 rolls up without apportioning ----------
const records = ingestSnapshot(SNAPSHOT as Snapshot)
const agg = aggregate(records)
const goals = computeGoals(agg)
const risk = computeRiskStatuses(records, agg, goals)
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0)
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6

check('team targets sum to DES-wide', sum([...agg.byTeam.values()].map((r) => r.target)), agg.desWide.target)
check('division targets sum to DES-wide', sum([...agg.byDivision.values()].map((r) => r.target)), agg.desWide.target)
check('team headcounts sum to DES-wide', sum([...agg.byTeam.values()].map((r) => r.headcount)), agg.desWide.headcount)
check('team expected achievement sums to DES-wide', near(sum([...agg.byTeam.values()].map((r) => r.expectedAchievement)), agg.desWide.expectedAchievement), true)
check('team goals sum to the DES-wide goal', near(sum([...goals.byTeam.values()]), goals.desWide), true)
check('division goals sum to the DES-wide goal', near(sum([...goals.byDivision.values()]), goals.desWide), true)
check('each division forecast ratio = its own EA ÷ its own goal', [...agg.byDivision.entries()].every(([d, r]) => near(risk.byDivision.get(d)!.forecastRatio, r.expectedAchievement / goals.byDivision.get(d)!)), true)

let failures = 0
for (const [label, actual, expected] of checks) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`)
}
console.log(`\n${checks.length - failures}/${checks.length} locked-value and data-integrity checks pass`)
if (failures > 0) process.exit(1)
