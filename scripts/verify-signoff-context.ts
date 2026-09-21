/**
 * Batch 3d acceptance-signal evidence: buildIndividualSignOffContext() and
 * buildMassSignOffContext() copy 3b's/3c's already-computed cross-check
 * results into a SignOffContext faithfully — same status/detail strings,
 * correct batchId propagation, nothing recomputed or dropped.
 * Run with: npm run verify:signoff-context
 */
import { buildIndividualSignOffContext, buildMassSignOffContext } from '../src/system1/engine/buildSignOffContext'
import type { OverrideCrossCheckResult } from '../src/system1/engine/overrideCrossCheck'
import type { MassAdjustmentCrossCheckResult } from '../src/system1/engine/massAdjustmentCrossCheck'
import type { Person } from '../src/system1/data/types'

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)} ${pass ? 'OK' : 'FAIL'}`)
  if (!pass) failures++
}

function person(id: string): Person {
  return {
    id,
    name: id,
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
  }
}

console.log('=== buildIndividualSignOffContext: hasOrgData true, mixed pass/fail ===')
{
  const result: OverrideCrossCheckResult = {
    hasOrgData: true,
    team: { status: 'fail', division: 'Design', team: 'Studio North', beforeHeadcount: 2, afterHeadcount: 3, beforeTotal: 100, afterTotal: 150, beforeStatus: 'On track', afterStatus: 'Off track', afterCoveragePct: 80, detail: 'team detail' },
    cohort: { status: 'pass', grade: 'Consultant', peerCount: 5, cohortAverage: 150, proposedValue: 160, deviationPct: 6.7, detail: 'cohort detail' },
    org: { status: 'pass', goal: 1000, beforeTotal: 900, afterTotal: 950, beforeExpected: 900, afterExpected: 930, beforeStatus: 'On track', afterStatus: 'On track', detail: 'org detail' },
    isDrasticChange: false,
    percentChange: 0.1,
    requiresSignOff: true,
    signOffReasons: ['Team total check failed: team detail'],
  }

  const context = buildIndividualSignOffContext(result)
  check('source is individual', context.source, 'individual')
  check('batchId is absent', context.batchId, undefined)
  check('reasons copied verbatim', context.reasons, result.signOffReasons)
  check('isDrasticChange copied', context.isDrasticChange, false)
  check('team status+detail copied, other fields dropped', context.team, { status: 'fail', detail: 'team detail' })
  check('cohort status+detail copied', context.cohort, { status: 'pass', detail: 'cohort detail' })
  check('org status+detail copied', context.org, { status: 'pass', detail: 'org detail' })
}

console.log()
console.log('=== buildIndividualSignOffContext: hasOrgData false (drastic-only) ===')
{
  const result: OverrideCrossCheckResult = {
    hasOrgData: false,
    team: null,
    cohort: null,
    org: null,
    isDrasticChange: true,
    percentChange: 0.5,
    requiresSignOff: true,
    signOffReasons: ['Drastic percentage change: +50.0%, over the ±20% threshold.'],
  }
  const context = buildIndividualSignOffContext(result)
  check('team is null', context.team, null)
  check('cohort is null', context.cohort, null)
  check('org is null', context.org, null)
  check('isDrasticChange true', context.isDrasticChange, true)
  check('reasons copied', context.reasons, result.signOffReasons)
}

console.log()
console.log('=== buildMassSignOffContext: batchId shared, aggregate groups shared, per-person individual results distinct ===')
{
  const p1 = person('P1')
  const p2 = person('P2')
  const individual1: OverrideCrossCheckResult = {
    hasOrgData: true,
    team: { status: 'pass', division: 'Design', team: 'Studio North', beforeHeadcount: 1, afterHeadcount: 2, beforeTotal: 100, afterTotal: 150, beforeStatus: 'On track', afterStatus: 'At risk', afterCoveragePct: 95, detail: 'p1 team detail' },
    cohort: { status: 'pass', grade: 'Consultant', peerCount: 3, cohortAverage: 150, proposedValue: 155, deviationPct: 3.3, detail: 'p1 cohort detail' },
    org: { status: 'pass', goal: 1000, beforeTotal: 900, afterTotal: 950, beforeExpected: 900, afterExpected: 930, beforeStatus: 'On track', afterStatus: 'On track', detail: 'p1 org detail' },
    isDrasticChange: false,
    percentChange: 0.05,
    requiresSignOff: false,
    signOffReasons: [],
  }
  const individual2: OverrideCrossCheckResult = {
    ...individual1,
    cohort: { ...individual1.cohort!, status: 'fail', detail: 'p2 cohort detail — outlier' },
    requiresSignOff: true,
    signOffReasons: ['Level-cohort norm check failed: p2 cohort detail — outlier'],
  }

  const massResult: MassAdjustmentCrossCheckResult = {
    hasOrgData: true,
    perPerson: [
      { person: p1, individual: individual1 },
      { person: p2, individual: individual2 },
    ],
    individualPassCount: 1,
    individualFailCount: 1,
    failBreakdown: { team: 0, cohort: 1, org: 0 },
    outliers: [{ person: p2, individual: individual2 }],
    aggregateGroups: [
      { key: 'Design::Studio North', label: 'Team Design / Studio North', level: 'team', beforeHeadcount: 1, afterHeadcount: 3, beforeTotal: 100, afterTotal: 260, beforeStatus: 'On track', afterStatus: 'At risk', status: 'pass', detail: 'aggregate team detail' },
    ],
    aggregateRequiresSignOff: false,
    aggregateSignOffReasons: [],
    routing: 'outliers-only',
  }

  const contextByPersonId = buildMassSignOffContext(massResult, 'batch-123')

  check('both people get a context', Object.keys(contextByPersonId).sort(), ['P1', 'P2'])
  check('P1 source is mass', contextByPersonId.P1.source, 'mass')
  check('both share the same batchId', [contextByPersonId.P1.batchId, contextByPersonId.P2.batchId], ['batch-123', 'batch-123'])
  check("P1's own cohort result (pass) is preserved, not overwritten by P2's", contextByPersonId.P1.cohort, { status: 'pass', detail: 'p1 cohort detail' })
  check("P2's own cohort result (fail) is preserved", contextByPersonId.P2.cohort, { status: 'fail', detail: 'p2 cohort detail — outlier' })
  check('both share the identical aggregate groups array content', contextByPersonId.P1.aggregateGroups, contextByPersonId.P2.aggregateGroups)
  check('aggregate group detail copied through', contextByPersonId.P1.aggregateGroups?.[0]?.detail, 'aggregate team detail')
  check('batchIndividualPassCount copied to both', [contextByPersonId.P1.batchIndividualPassCount, contextByPersonId.P2.batchIndividualPassCount], [1, 1])
  check('batchIndividualFailCount copied to both', [contextByPersonId.P1.batchIndividualFailCount, contextByPersonId.P2.batchIndividualFailCount], [1, 1])
  check('batchSize is 2 for both', [contextByPersonId.P1.batchSize, contextByPersonId.P2.batchSize], [2, 2])
}

console.log()
if (failures > 0) {
  console.error(`${failures} check(s) failed.`)
  process.exit(1)
}
console.log('All sign-off context mapping checks passed.')
