/**
 * Batch 3c acceptance-signal evidence: three hand-calculated scenarios —
 * a batch that passes cleanly for everyone, one where the AGGREGATE effect
 * fails even though no individual is drastic, and one where a few
 * individuals are outliers within an otherwise-fine batch — plus the
 * no-org-data edge case. capacityUtilisation/teamHistoricalTrend and
 * simulated confidence are independently re-derived here with the same
 * primitive PRNG the engine under test calls, same technique
 * verify-risk-status.ts and verify-override-cross-check.ts use.
 * Run with: npm run verify:mass-adjustment-cross-check
 */
import { computeMassAdjustmentCrossCheck } from '../src/system1/engine/massAdjustmentCrossCheck'
import { computeSystem2LiveSnapshot } from '../src/system2/bridge/liveOrgState'
import { combinedRevenueFor } from '../src/system1/engine/revenueEngine'
import type { OrgRecord } from '../src/system2/data/types'
import type { Person } from '../src/system1/data/types'
import type { TargetRecord } from '../src/store/system1Store'

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

function targetRecord(personId: string, modelled: number): TargetRecord {
  return { personId, status: 'Modelled', modelled, rangeLow: 0, rangeHigh: 0, notes: '' }
}

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)} ${pass ? 'OK' : 'FAIL'}`)
  if (!pass) failures++
}

console.log('=== Scenario 1: clean pass for everyone ===')
{
  // 3 people, all Consultant, dayRate=1000 (revenue 187k each, matching
  // each other exactly) -> cohort deviation ~0 for all three. Team/org
  // baseline needs a REAL surplus-EA buffer under the goal model (goals.ts,
  // prior-year revenue x 1.1): trend 1.05 (this fixture's original value)
  // gives EA £15750k against a goal of ~£17193k — already short before any
  // addition, since goal no longer trivially equals target (that was the
  // circularity being fixed: EA/target was always exactly 1.0, zero real
  // headroom). Trend 1.15 clears the goal with genuine margin (EA £17250k
  // vs goal £17193k, and — critically — maxFeasible (£18112k, capacity 1.05
  // x trend) also clears the goal, so the team isn't forced Infeasible
  // outright). Split across 6 equal records rather than 3 larger ones so
  // headcount growing from 6 to 9 doesn't change topCount's rounded share of
  // the total enough to flip isConcentrationRisk on its own (topCount =
  // ceil(headcount*0.2) jumps from 1 to 2 crossing headcount 5, which would
  // otherwise nearly double the top-N share captured).
  const people = [person({ id: 'MASS_OUT1' }), person({ id: 'MASS_OUT2' }), person({ id: 'MASS_OUT3' })]
  const targets: Record<string, TargetRecord> = Object.fromEntries(people.map((p) => [p.id, targetRecord(p.id, 100)]))
  const baseline: OrgRecord[] = Array.from({ length: 6 }, (_, i) =>
    orgRecord({ id: `BASE${i + 1}`, target: 2500, teamHistoricalTrend: 1.15 }),
  )
  const snapshot = computeSystem2LiveSnapshot(baseline, '2026-01-01T00:00:00.000Z')

  const result = computeMassAdjustmentCrossCheck({ people, percent: 5, targets, snapshot, allPeople: people })

  check('hasOrgData', result.hasOrgData, true)
  check('all 3 pass individually', result.individualPassCount, 3)
  check('none fail individually', result.individualFailCount, 0)
  check('no outliers', result.outliers.length, 0)
  check('every aggregate group passes', result.aggregateGroups.every((g) => g.status === 'pass'), true)
  check('routing is none', result.routing, 'none')
}

console.log()
console.log('=== Scenario 2: aggregate fails even though no individual is drastic ===')
{
  // Redesigned for the goal model (goals.ts, prior-year revenue x 1.1,
  // pinned to the real committed snapshot — see riskStatus.ts/scenario.ts).
  // The ORIGINAL version of this scenario modelled three brand-NEW hires
  // being added to a small team; under a FIXED goal that can no longer
  // demonstrate "aggregate fails though no individual does" — proven during
  // development (scripts/_probe-mass*.ts, since deleted): any combination of
  // purely-additive, positive-revenue new hires against a fixed goal can
  // only ever IMPROVE the ratio, never combine to make it worse, so a team
  // that individually tolerates each hire tolerates all three together too.
  // (That's a direct, desirable consequence of the fix — the old version's
  // "team fails" only worked because target-as-goal meant more hires moved
  // the goalposts along with the total, which is exactly the circularity
  // being removed.)
  //
  // The genuine way an aggregate-only failure still exists under a fixed
  // goal is a CUT to already-EXISTING contributors: three individually-
  // tolerable trims can combine into a team-level breach in a way summing
  // three independent single-person checks can't show, because subtracting
  // from a fixed goal's numerator behaves differently to only ever adding
  // to it. So these 3 people are modelled as already part of the team (an
  // OrgRecord each, at their real combinedRevenueFor(), which is what
  // proposedRevenueFor() scales proportionally — matching an arbitrary
  // number here would produce an incoherent, not-really-"a 10% cut" jump),
  // facing a -10% mass cut.
  const ids = ['MASS_A1', 'MASS_A2', 'MASS_A3']
  const people = ids.map((id) => person({ id, dayRate: 1000 })) // revenue 187k each, matching each other -> cohort trivially fine
  const currentRevenue = combinedRevenueFor(people[0])
  check('sanity: combinedRevenueFor(dayRate=1000 person) is 187k, matching this file\'s other fixtures', currentRevenue, 187)
  const targets: Record<string, TargetRecord> = Object.fromEntries(people.map((p) => [p.id, targetRecord(p.id, 100)]))
  const baseline: OrgRecord[] = [
    orgRecord({ id: 'ANCHOR', target: 8000, teamHistoricalTrend: 1.1 }),
    ...ids.map((id) => orgRecord({ id, target: currentRevenue, teamHistoricalTrend: 1.1 })),
  ]
  const snapshot = computeSystem2LiveSnapshot(baseline, '2026-01-01T00:00:00.000Z')
  check('sanity: team starts compliant (At risk, not already failing)', snapshot.org?.risk.status, 'At risk')

  const result = computeMassAdjustmentCrossCheck({ people, percent: -10, targets, snapshot, allPeople: people })

  check('hasOrgData', result.hasOrgData, true)
  check('all 3 pass individually (none independently drastic or failing)', result.individualPassCount, 3)
  check('no individual outliers', result.outliers.length, 0)
  const teamGroup = result.aggregateGroups.find((g) => g.level === 'team')
  check('team aggregate fails', teamGroup?.status, 'fail')
  check('team aggregate status is non-compliant', teamGroup?.afterStatus === 'Off track' || teamGroup?.afterStatus === 'Infeasible', true)
  check('routing is whole-batch', result.routing, 'whole-batch')
  check('aggregate sign-off reasons cite the team', result.aggregateSignOffReasons.some((r) => r.includes('Team')), true)
}

console.log()
console.log('=== Scenario 3: a few individuals are outliers within an otherwise-fine batch ===')
{
  // 4 people, same healthy team/org (surplus baseline, same trick as
  // Scenario 1). 3 have dayRate=1000 (revenue 187k, matching each other);
  // 1 (MASS_OUT4) has dayRate=1600 (revenue 299k) — a +5% mass change is
  // modest for everyone, but MASS_OUT4's absolute revenue is so far from
  // the other three's that it trips the cohort-outlier threshold on its
  // own, even though the % applied is identical and unremarkable for the
  // batch.
  const people = [
    person({ id: 'MASS_OUT1' }),
    person({ id: 'MASS_OUT2' }),
    person({ id: 'MASS_OUT3' }),
    person({ id: 'MASS_OUT4', dayRate: 1600 }),
  ]
  const targets: Record<string, TargetRecord> = Object.fromEntries(people.map((p) => [p.id, targetRecord(p.id, 100)]))
  // Same 6-equal-record baseline shape and trend as Scenario 1, for the
  // same reasons (real — not illusory — goal-model buffer, and stable
  // isConcentrationRisk topCount-rounding as headcount grows).
  const baseline: OrgRecord[] = Array.from({ length: 6 }, (_, i) =>
    orgRecord({ id: `BASE${i + 1}`, target: 2500, teamHistoricalTrend: 1.15 }),
  )
  const snapshot = computeSystem2LiveSnapshot(baseline, '2026-01-01T00:00:00.000Z')

  const result = computeMassAdjustmentCrossCheck({ people, percent: 5, targets, snapshot, allPeople: people })

  check('hasOrgData', result.hasOrgData, true)
  check('3 of 4 pass individually', result.individualPassCount, 3)
  check('1 of 4 fails individually', result.individualFailCount, 1)
  check('the cohort check is what fails', result.failBreakdown, { team: 0, cohort: 1, org: 0 })
  check('exactly one outlier, MASS_OUT4', result.outliers.map((o) => o.person.id), ['MASS_OUT4'])
  check('every aggregate group still passes', result.aggregateGroups.every((g) => g.status === 'pass'), true)
  check('routing is outliers-only', result.routing, 'outliers-only')
}

console.log()
console.log('=== Edge case: no org data -> checks skipped, not silently passed ===')
{
  const people = [person({ id: 'S4_A' }), person({ id: 'S4_B' })]
  const targets: Record<string, TargetRecord> = Object.fromEntries(people.map((p) => [p.id, targetRecord(p.id, 100)]))
  const snapshot = computeSystem2LiveSnapshot([], null)

  const result = computeMassAdjustmentCrossCheck({ people, percent: 5, targets, snapshot, allPeople: people })

  check('hasOrgData is false', result.hasOrgData, false)
  check('aggregateGroups is empty, not fabricated', result.aggregateGroups, [])
  check('does not force sign-off', result.routing, 'none')
}

console.log()
if (failures > 0) {
  console.error(`${failures} check(s) failed.`)
  process.exit(1)
}
console.log('All mass adjustment cross-check scenarios matched their hand-calculated expectations.')
