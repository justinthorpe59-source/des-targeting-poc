/**
 * S2-M7 acceptance-signal evidence: "running a scenario changes the result
 * for the lever being tested while baseline stays untouched." Run with:
 * npm run verify:scenario
 *
 * Also guards the bug playwright-mcp caught during manual verification: a
 * group-override's returned aggregation and riskStatuses must agree with
 * each other (an overridden group's rollup.expectedAchievement must match
 * the forecastRatio shown for that same group) — an earlier version patched
 * only riskStatuses and left aggregation stale.
 */
import { aggregate } from '../src/system2/engine/aggregation'
import { applyLeverTransforms, runScenario, type ScenarioLevers } from '../src/system2/engine/scenario'
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

const records: OrgRecord[] = [
  record({ id: 'R1', division: 'Design', team: 'Studio North', target: 200, capacityUtilisation: 0.82, teamHistoricalTrend: 0.86 }),
  record({ id: 'R2', division: 'Design', team: 'Studio South', target: 80, capacityUtilisation: 0.86, teamHistoricalTrend: 0.96 }),
  record({ id: 'R3', division: 'Engineering', team: 'Platform', target: 50, capacityUtilisation: 0.88, teamHistoricalTrend: 0.97 }),
]

// --- Non-mutation: applyLeverTransforms/runScenario never touch the input array or its objects ---
{
  const frozenSnapshot = JSON.parse(JSON.stringify(records))
  const levers: ScenarioLevers = {
    goal: 999,
    capacityChange: { scope: { level: 'division', division: 'Design' }, multiplier: 1.5 },
    populationAdjustmentPercent: 20,
    groupOverride: { target: { level: 'division', division: 'Engineering' }, expectedAchievement: 500, confidence: 'Low' },
  }
  runScenario(records, levers)
  check('runScenario never mutates the input records array', records, frozenSnapshot)
}

// --- Lever 1 (goal): DES-wide only, divisions/teams untouched ---
{
  const baseline = { aggregation: aggregate(records), riskStatuses: undefined }
  const scenario = runScenario(records, { goal: 100 })
  check('lever 1: DES-wide forecast ratio reflects the new goal', Math.round(scenario.riskStatuses.desWide.forecastRatio * 1000) / 1000, Math.round((baseline.aggregation.desWide.expectedAchievement / 100) * 1000) / 1000)
  check('lever 1: division rollups are byte-identical to baseline (no apportioning)', [...scenario.aggregation.byDivision.entries()], [...baseline.aggregation.byDivision.entries()])
}

// --- Lever 2 (capacity, team-scoped): only the targeted team's records change, cascades upward ---
{
  const scenario = runScenario(records, { capacityChange: { scope: { level: 'team', division: 'Design', team: 'Studio North' }, multiplier: 1.25 } })
  const expectedR1 = 200 * (0.82 * 1.25) * 0.86
  const studioNorth = scenario.aggregation.byTeam.get('Design::Studio North')!
  const studioSouth = scenario.aggregation.byTeam.get('Design::Studio South')!
  check('lever 2: targeted team (Studio North) expected achievement scales', Math.round(studioNorth.expectedAchievement * 1000) / 1000, Math.round(expectedR1 * 1000) / 1000)
  check('lever 2: untouched sibling team (Studio South) is unaffected', studioSouth.expectedAchievement, 80 * 0.86 * 0.96)
  check('lever 2: cascades to the parent division', scenario.aggregation.byDivision.get('Design')!.expectedAchievement, expectedR1 + 80 * 0.86 * 0.96)
}

// --- Lever 3 (population-wide adjustment): every record's target scales, goal does NOT (it's pinned to the real baseline records — see goals.ts), so ratio scales too ---
{
  const baseline = runScenario(records, {})
  const scenario = runScenario(records, { populationAdjustmentPercent: 10 })
  check('lever 3: DES-wide target scales by +10%', scenario.aggregation.desWide.target, Math.round(baseline.aggregation.desWide.target * 1.1))
  check('lever 3: goal is untouched by the population lever (pinned to the real baseline records)', scenario.goals.desWide, baseline.goals.desWide)
  check(
    "lever 3: forecast ratio scales by +10% too, since goal is fixed — this is the bug fix goals.ts exists for: goal used to be re-derived from the (lever-adjusted) target sum, making coverage move in lockstep with whatever this lever changed",
    Math.round(scenario.riskStatuses.desWide.forecastRatio * 1000) / 1000,
    Math.round(baseline.riskStatuses.desWide.forecastRatio * 1.1 * 1000) / 1000,
  )
}

// --- Lever 4 (group override): consistent aggregation+riskStatus, no cascade to parent or siblings ---
{
  const baseline = runScenario(records, {})
  const scenario = runScenario(records, {
    groupOverride: { target: { level: 'division', division: 'Engineering' }, expectedAchievement: 55, confidence: 'High' },
  })
  const overridden = scenario.aggregation.byDivision.get('Engineering')!
  const overriddenRisk = scenario.riskStatuses.byDivision.get('Engineering')!
  const engineeringGoal = scenario.goals.byDivision.get('Engineering')!
  check('lever 4: rollup and risk assessment agree on the overridden expected achievement', overridden.expectedAchievement, 55)
  check(
    "lever 4: forecast ratio matches the overridden value over the division's own computed goal (not its target, and not the pre-override expected achievement)",
    Math.round(overriddenRisk.forecastRatio * 1000) / 1000,
    Math.round((55 / engineeringGoal) * 1000) / 1000,
  )
  check('lever 4: confidence override applied', overriddenRisk.confidence, 'High')
  check('lever 4: does not cascade to DES-wide', scenario.aggregation.desWide, baseline.aggregation.desWide)
  check('lever 4: does not cascade to a sibling division (Design)', scenario.aggregation.byDivision.get('Design'), baseline.aggregation.byDivision.get('Design'))
}

// --- Determinism: same records/levers in, same result out, every time ---
{
  const levers: ScenarioLevers = { goal: 400, capacityChange: { scope: { level: 'division', division: 'Design' }, multiplier: 1.1 } }
  const serialise = (r: ReturnType<typeof runScenario>) =>
    JSON.stringify({ desWide: r.riskStatuses.desWide, byDivision: [...r.riskStatuses.byDivision.entries()] })
  const run1 = serialise(runScenario(records, levers))
  const run2 = serialise(runScenario(records, levers))
  check('determinism: same records/levers produce byte-identical results', run1 === run2, true)
}

// --- applyLeverTransforms is pure: same input, same output, input untouched ---
{
  const input = [...records]
  const out1 = applyLeverTransforms(input, { populationAdjustmentPercent: 5 })
  const out2 = applyLeverTransforms(input, { populationAdjustmentPercent: 5 })
  check('applyLeverTransforms: deterministic', JSON.stringify(out1), JSON.stringify(out2))
  check('applyLeverTransforms: input array untouched', input, records)
}

console.log()
if (failures > 0) {
  console.error(`${failures} check(s) failed.`)
  process.exit(1)
}
console.log('All scenario checks passed.')
