/**
 * Batch 3b acceptance-signal evidence: hand-calculated pass/fail for four
 * scenarios (all-pass, cohort-outlier-fail, team-coverage-fail, drastic-
 * percentage-change), plus the no-org-data edge case. capacityUtilisation/
 * teamHistoricalTrend for each hypothetical person are deterministic per id
 * (same PRNG ingestSnapshot.ts uses) — computed independently here with the
 * same technique verify-risk-status.ts uses for seed-dependent values
 * ("the PRNG is a black box from this script's side, find/derive it, don't
 * assume it"), not copied from the engine under test.
 * Run with: npm run verify:override-cross-check
 */
import { runOverrideCrossCheck } from '../src/system1/engine/overrideCrossCheck'
import { computeSystem2LiveSnapshot } from '../src/system2/bridge/liveOrgState'
import { mulberry32, randRange, seedFromId } from '../src/system2/engine/prng'
import { aggregate } from '../src/system2/engine/aggregation'
import { computeGoals } from '../src/system2/engine/goals'
import type { OrgRecord } from '../src/system2/data/types'
import type { Person } from '../src/system1/data/types'

function orgRecord(overrides: Partial<OrgRecord> & { id: string }): OrgRecord {
  return {
    division: 'Design',
    team: 'Studio North',
    location: 'Boston',
    gradeCode: 3,
    roleTitle: 'Consultant',
    approvedAt: '2026-01-01T00:00:00.000Z',
    target: 0,
    capacityUtilisation: 1,
    teamHistoricalTrend: 1,
    ...overrides,
  }
}

function person(overrides: Partial<Person> & { id: string }): Person {
  return {
    name: overrides.id,
    division: 'Design',
    team: 'Studio North',
    location: 'Boston',
    grade: 'Consultant',
    roleFactor: 1.05,
    capacity: 0.8,
    economicFactor: 1.0,
    baseline: 100,
    dayRate: 1000,
    utilisationTarget: 0.85,
    salesTarget: null,
    ...overrides,
  }
}

// Independently re-derive the deterministic capacity/trend for an id — same
// primitive PRNG ingestSnapshot.ts (and the engine under test) call, used
// here only as a black box, not as a copy of the code being verified.
function expectedCapacityAndTrend(id: string) {
  const rng = mulberry32(seedFromId(id))
  return {
    capacityUtilisation: Math.round(randRange(rng, 0.75, 1.05) * 100) / 100,
    teamHistoricalTrend: Math.round(randRange(rng, 0.85, 1.05) * 100) / 100,
  }
}

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)} ${pass ? 'OK' : 'FAIL'}`)
  if (!pass) failures++
}

// 3 cohort peers, all 'Consultant', dayRate=1000 -> revenue = round(1000*0.85*220/1000) = 187k each.
// Cohort average = 187k exactly.
const cohortPeers: Person[] = [
  person({ id: 'PEER1' }),
  person({ id: 'PEER2' }),
  person({ id: 'PEER3' }),
]

console.log(`Sanity: cohort peer revenue is 187k each (1000 x 0.85 x 220 / 1000 = 187): expect avg 187`)

console.log()
console.log('=== Scenario A: passes all 3 checks ===')
{
  const testId = 'XCHK_PASS'
  const { capacityUtilisation, teamHistoricalTrend } = expectedCapacityAndTrend(testId)
  check('sanity: PRNG draw for this id', { capacityUtilisation, teamHistoricalTrend }, { capacityUtilisation: 0.86, teamHistoricalTrend: 1 })

  const testPerson = person({ id: testId, dayRate: 1000 }) // revenue = 187k, matches cohort exactly
  // Large-buffer team/org so this one person's addition can't tip ratio below 0.9 either way.
  // teamHistoricalTrend 1.3 (not the default 1) is what makes this a genuine
  // buffer under the goal model (goals.ts): goal is prior-year revenue x
  // 1.1, which for this team's own current £4000k can be at most
  // ~£4632k (worst case within GROWTH_RATE_RANGE) — trend 1 alone (EA=
  // £4000k) would sit BELOW that, i.e. already failing before any change,
  // same as goal used to trivially equal target (EA/target was always
  // exactly 1.0, zero real headroom). Trend 1.3 (EA=£5200k) clears the
  // worst-case goal with real margin, restoring an actually-generous buffer.
  const records: OrgRecord[] = [
    orgRecord({ id: 'R1', division: 'Design', team: 'Studio North', target: 2000, teamHistoricalTrend: 1.3 }),
    orgRecord({ id: 'R2', division: 'Design', team: 'Studio North', target: 2000, teamHistoricalTrend: 1.3 }),
  ]
  const snapshot = computeSystem2LiveSnapshot(records, '2026-01-01T00:00:00.000Z')

  // +5% on the baseline-formula target -> proposed revenue = round(187 * 1.05) = 196.
  const result = runOverrideCrossCheck({
    person: testPerson,
    proposedFinalTarget: 105,
    currentModelledTarget: 100,
    snapshot,
    people: [...cohortPeers, testPerson],
  })

  check('team check passes', result.team?.status, 'pass')
  check('team after total', result.team?.afterTotal, 2000 + 2000 + 196)
  check('cohort check passes', result.cohort?.status, 'pass')
  check('cohort deviation ~4.8%', result.cohort?.deviationPct, 4.8)
  check('org check passes', result.org?.status, 'pass')
  check('not a drastic change', result.isDrasticChange, false)
  check('no sign-off required', result.requiresSignOff, false)
  check('no sign-off reasons', result.signOffReasons, [])
}

console.log()
console.log('=== Scenario B: fails cohort-norm check specifically (team/org pass, non-drastic) ===')
{
  const testId = 'XCHK_COHORT_FAIL'
  const { capacityUtilisation, teamHistoricalTrend } = expectedCapacityAndTrend(testId)
  check('sanity: PRNG draw for this id', { capacityUtilisation, teamHistoricalTrend }, { capacityUtilisation: 0.85, teamHistoricalTrend: 0.89 })

  // dayRate 1100 (not 1000) -> current revenue = round(1100*0.85*220/1000) = 206k, already off the 187k cohort average.
  const testPerson = person({ id: testId, dayRate: 1100 })
  // Same real (not illusory) buffer as Scenario A — see its comment.
  const records: OrgRecord[] = [
    orgRecord({ id: 'R1', division: 'Design', team: 'Studio North', target: 2000, teamHistoricalTrend: 1.3 }),
    orgRecord({ id: 'R2', division: 'Design', team: 'Studio North', target: 2000, teamHistoricalTrend: 1.3 }),
  ]
  const snapshot = computeSystem2LiveSnapshot(records, '2026-01-01T00:00:00.000Z')

  // +15% on the target (non-drastic, <=20%) -> proposed revenue = round(206 * 1.15) = 237.
  const result = runOverrideCrossCheck({
    person: testPerson,
    proposedFinalTarget: 115,
    currentModelledTarget: 100,
    snapshot,
    people: [...cohortPeers, testPerson],
  })

  check('team check passes', result.team?.status, 'pass')
  check('cohort check fails', result.cohort?.status, 'fail')
  check('cohort deviation ~26.7%, over the 25% threshold', result.cohort?.deviationPct, 26.7)
  check('org check passes', result.org?.status, 'pass')
  check('not a drastic change (15% <= 20%)', result.isDrasticChange, false)
  check('sign-off required (cohort failure alone)', result.requiresSignOff, true)
  check('exactly one sign-off reason, naming the cohort check', result.signOffReasons.length, 1)
  check('sign-off reason mentions the cohort check', result.signOffReasons[0]?.includes('Level-cohort'), true)
}

console.log()
console.log('=== Scenario C: fails team-coverage check specifically (cohort/org pass, non-drastic) ===')
{
  const testId = 'XCHK_TEAM_FAIL'
  const { capacityUtilisation, teamHistoricalTrend } = expectedCapacityAndTrend(testId)
  check('sanity: PRNG draw for this id', { capacityUtilisation, teamHistoricalTrend }, { capacityUtilisation: 0.78, teamHistoricalTrend: 0.86 })

  const testPerson = person({ id: testId, dayRate: 1000 }) // revenue 187k, matches cohort exactly
  // Under the goal model (goals.ts, prior-year revenue x 1.1), a tiny
  // pre-existing team can no longer be driven to fail by one large
  // hypothetical addition — its goal is tiny too (jittered off its own
  // small current revenue), so any real contribution clears it easily. The
  // genuine way to make a team fail now is a team that's ALREADY
  // underperforming relative to its own revenue base: R_TEAM's target
  // (£2000k) sets a goal of ~£2292k (independently verified below), but its
  // capacity/trend (0.5/0.5) caps its own expected achievement at £500k —
  // failing long before this person's addition, and the hypothetical
  // person (EA 196*0.78*0.86=131.5) can't meaningfully move that. Two
  // other large, healthy teams elsewhere (£50k -> £50000k target,
  // trend 1.1, so their OWN maxFeasible clears their OWN goal too) keep
  // the ORG total comfortably covered — verified via scripts/_probe-fixtures
  // during development (teamRatio 0.218 vs orgRatio 1.003, org maxFeasible
  // 116550 vs org goal ~110170, both stable, not boundary-close).
  const records: OrgRecord[] = [
    orgRecord({ id: 'R_TEAM', division: 'Design', team: 'Studio North', target: 2000, capacityUtilisation: 0.5, teamHistoricalTrend: 0.5 }),
    orgRecord({ id: 'R_OTHER1', division: 'Engineering', team: 'Platform', target: 50000, teamHistoricalTrend: 1.1 }),
    orgRecord({ id: 'R_OTHER2', division: 'Science', team: 'Research', target: 50000, teamHistoricalTrend: 1.1 }),
  ]
  const snapshot = computeSystem2LiveSnapshot(records, '2026-01-01T00:00:00.000Z')
  {
    // Hand-verify the team/org goals this scenario depends on, the same
    // rigour verify-risk-status.ts applies elsewhere — derived from the
    // real primitive (computeGoals), not a guessed magic number.
    const directAggregation = aggregate(records)
    const directGoals = computeGoals(directAggregation)
    const teamGoal = directGoals.byTeam.get('Design::Studio North')!
    check('sanity: R_TEAM-only team goal is ~2292k (prior-year revenue x 1.1 off its own £2000k target)', Math.round(teamGoal), 2292)
    check('sanity: R_TEAM-only team EA (500) is already below that goal, before any hypothetical addition', 500 < teamGoal, true)
  }

  const result = runOverrideCrossCheck({
    person: testPerson,
    proposedFinalTarget: 105, // +5%
    currentModelledTarget: 100,
    snapshot,
    people: [...cohortPeers, testPerson],
  })

  check('team check fails', result.team?.status, 'fail')
  check('team after total', result.team?.afterTotal, 2000 + 196)
  check('team after status is non-compliant', result.team?.afterStatus === 'Off track' || result.team?.afterStatus === 'Infeasible', true)
  check('cohort check passes', result.cohort?.status, 'pass')
  check('org check passes (other team covers it)', result.org?.status, 'pass')
  check('not a drastic change', result.isDrasticChange, false)
  check('sign-off required (team failure alone)', result.requiresSignOff, true)
  check('exactly one sign-off reason, naming the team check', result.signOffReasons.length, 1)
  check('sign-off reason mentions the team check', result.signOffReasons[0]?.includes('Team total'), true)
}

console.log()
console.log('=== Scenario D: drastic percentage change routes to sign-off even when all 3 checks pass ===')
{
  const testId = 'XCHK_DRASTIC'
  const { capacityUtilisation, teamHistoricalTrend } = expectedCapacityAndTrend(testId)
  check('sanity: PRNG draw for this id', { capacityUtilisation, teamHistoricalTrend }, { capacityUtilisation: 0.94, teamHistoricalTrend: 0.89 })

  const testPerson = person({ id: testId, dayRate: 1000 }) // revenue 187k, matches cohort exactly
  // Same real buffer as Scenario A — see its comment.
  const records: OrgRecord[] = [
    orgRecord({ id: 'R1', division: 'Design', team: 'Studio North', target: 2000, teamHistoricalTrend: 1.3 }),
    orgRecord({ id: 'R2', division: 'Design', team: 'Studio North', target: 2000, teamHistoricalTrend: 1.3 }),
  ]
  const snapshot = computeSystem2LiveSnapshot(records, '2026-01-01T00:00:00.000Z')

  // +22% on the target: over the 20% drastic-change threshold, but since
  // deviation == |percentChange| whenever current revenue == cohort average
  // (as set up here), 22% stays under the 25% cohort-outlier threshold too —
  // isolating the drastic-change trigger from a check failure.
  const result = runOverrideCrossCheck({
    person: testPerson,
    proposedFinalTarget: 122,
    currentModelledTarget: 100,
    snapshot,
    people: [...cohortPeers, testPerson],
  })

  check('team check passes', result.team?.status, 'pass')
  check('cohort check passes (22% <= 25%)', result.cohort?.status, 'pass')
  check('org check passes', result.org?.status, 'pass')
  check('is a drastic change (22% > 20%)', result.isDrasticChange, true)
  check('sign-off required (drastic change alone)', result.requiresSignOff, true)
  check('exactly one sign-off reason, naming the drastic change', result.signOffReasons.length, 1)
  check('sign-off reason mentions drastic change', result.signOffReasons[0]?.includes('Drastic'), true)
}

console.log()
console.log('=== Edge case: no org data yet, modest change -> checks skipped, no sign-off forced ===')
{
  const testPerson = person({ id: 'XCHK_NO_DATA' })
  const snapshot = computeSystem2LiveSnapshot([], null)
  const result = runOverrideCrossCheck({
    person: testPerson,
    proposedFinalTarget: 105, // +5%, not drastic
    currentModelledTarget: 100,
    snapshot,
    people: [...cohortPeers, testPerson],
  })
  check('hasOrgData is false', result.hasOrgData, false)
  check('team is null, not a fabricated pass', result.team, null)
  check('cohort is null, not a fabricated pass', result.cohort, null)
  check('org is null, not a fabricated pass', result.org, null)
  check('does not force sign-off (checks are skipped, not failed)', result.requiresSignOff, false)
}

console.log()
console.log('=== Edge case: no org data yet, but a drastic change still routes to sign-off ===')
{
  // The drastic-% trigger is a plain target-value comparison — it doesn't
  // need System 2 data, and pre-dates this batch (Manager Override's
  // existing inline large-adjustment flag already works with no org data).
  const testPerson = person({ id: 'XCHK_NO_DATA_DRASTIC' })
  const snapshot = computeSystem2LiveSnapshot([], null)
  const result = runOverrideCrossCheck({
    person: testPerson,
    proposedFinalTarget: 200, // +100%, well over the 20% threshold
    currentModelledTarget: 100,
    snapshot,
    people: [...cohortPeers, testPerson],
  })
  check('hasOrgData is false', result.hasOrgData, false)
  check('team/cohort/org are still null — checks themselves are not run', [result.team, result.cohort, result.org], [null, null, null])
  check('is a drastic change', result.isDrasticChange, true)
  check('sign-off is still required, via the drastic-change trigger alone', result.requiresSignOff, true)
  check('exactly one sign-off reason, naming the drastic change', result.signOffReasons.length, 1)
}

console.log()
if (failures > 0) {
  console.error(`${failures} check(s) failed.`)
  process.exit(1)
}
console.log('All override cross-check scenarios matched their hand-calculated expectations.')
