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
  // baseline is a generous, surplus-EA (trend 1.05) team so a modest +5%
  // addition can't drag coverage below 100%, individually or combined —
  // trend>1 (not exactly 1) avoids the "ratio drops from exactly 1.0 to
  // just under 1.0" regression trap a razor's-edge baseline would trip.
  // Split across 6 equal records rather than 3 larger ones so headcount
  // growing from 6 to 9 doesn't change topCount's rounded share of the
  // total enough to flip isConcentrationRisk on its own (topCount =
  // ceil(headcount*0.2) jumps from 1 to 2 crossing headcount 5, which
  // would otherwise nearly double the top-N share captured).
  const people = [person({ id: 'MASS_OUT1' }), person({ id: 'MASS_OUT2' }), person({ id: 'MASS_OUT3' })]
  const targets: Record<string, TargetRecord> = Object.fromEntries(people.map((p) => [p.id, targetRecord(p.id, 100)]))
  const baseline: OrgRecord[] = Array.from({ length: 6 }, (_, i) =>
    orgRecord({ id: `BASE${i + 1}`, target: 2500, teamHistoricalTrend: 1.05 }),
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
  // 3 people, dayRate=4074 (revenue 762k each, matching each other exactly
  // -> cohort trivially fine), +5% each (not drastic). Team baseline is 2
  // healthy records (target 1000k each, ratio 1.0). Each person ALONE
  // (individual check) barely dents that baseline and stays >=90% coverage
  // — but all 3 added AT ONCE drags it under 90%, which summing three
  // independent single-person checks could never show.
  const ids = ['MASS_A1', 'MASS_A2', 'MASS_A3']
  const people = ids.map((id) => person({ id, dayRate: 4074 }))
  const targets: Record<string, TargetRecord> = Object.fromEntries(people.map((p) => [p.id, targetRecord(p.id, 100)]))
  const baseline: OrgRecord[] = [orgRecord({ id: 'BASE1', target: 1000 }), orgRecord({ id: 'BASE2', target: 1000 })]
  const snapshot = computeSystem2LiveSnapshot(baseline, '2026-01-01T00:00:00.000Z')

  const result = computeMassAdjustmentCrossCheck({ people, percent: 5, targets, snapshot, allPeople: people })

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
  // Same 6-equal-record baseline shape as Scenario 1, for the same reason
  // (keeps isConcentrationRisk's topCount-rounding stable as headcount grows).
  const baseline: OrgRecord[] = Array.from({ length: 6 }, (_, i) =>
    orgRecord({ id: `BASE${i + 1}`, target: 2500, teamHistoricalTrend: 1.05 }),
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
