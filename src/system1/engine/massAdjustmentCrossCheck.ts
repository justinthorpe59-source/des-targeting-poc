import type { Division, Person } from '../data/types'
import type { TargetRecord } from '../../store/system1Store'
import {
  buildHypotheticalOrgRecord,
  isCompliant,
  proposedRevenueFor,
  runOverrideCrossCheck,
  stillSensible,
  type OverrideCrossCheckResult,
} from './overrideCrossCheck'
import { aggregate, type Rollup } from '../../system2/engine/aggregation'
import { assessRisk, type RiskStatus } from '../../system2/engine/riskStatus'
import type { OrgRecord } from '../../system2/data/types'
import { getDivisionLiveState, getTeamLiveState, type System2LiveSnapshot } from '../../system2/bridge/liveOrgState'

/**
 * Batch 3c: extends 3b's cross-check to Mass Adjustment. Two distinct
 * computations, both reusing 3a/3b's primitives rather than re-deriving
 * anything:
 *
 *   1. Per-person, independent — runOverrideCrossCheck() called once per
 *      affected person, holding everyone else's CURRENT (unmodified) state
 *      fixed. This is "if only this one person's change were applied" —
 *      exactly what 3b already computes for Manager Override, just looped.
 *      Gives the pass/fail breakdown and flags individual outliers.
 *
 *   2. Aggregate — every affected person's hypothetical change folded into
 *      the record set AT ONCE, per affected team, per affected division,
 *      and DES-wide. This is what individually-summed results can't show:
 *      many small, individually-fine changes can combine into a team/org
 *      problem. Same aggregate()/assessRisk() calls as 3b, same absolute
 *      (team/division) vs regression-aware (org) pass/fail split — just
 *      over a multi-person hypothetical record set instead of a one-person
 *      swap.
 *
 * Routing (per the locked spec): the aggregate failing routes the WHOLE
 * batch to Pending Sign-off, regardless of how any individual looks — a
 * team/org-level problem isn't something a manager should be able to route
 * around by approving people one at a time. If the aggregate passes, only
 * individuals who independently trip sign-off (a failed check of their own,
 * or a drastic % change) are held back; everyone else applies normally.
 */

export interface MassAdjustmentGroupCheck {
  key: string
  label: string
  level: 'team' | 'division' | 'org'
  beforeHeadcount: number
  afterHeadcount: number
  beforeTotal: number
  afterTotal: number
  beforeStatus: RiskStatus | null
  afterStatus: RiskStatus
  status: 'pass' | 'fail'
  detail: string
}

export interface MassAdjustmentPersonOutcome {
  person: Person
  individual: OverrideCrossCheckResult
}

export type MassAdjustmentRouting = 'whole-batch' | 'outliers-only' | 'none'

export interface MassAdjustmentCrossCheckResult {
  hasOrgData: boolean
  perPerson: MassAdjustmentPersonOutcome[]
  individualPassCount: number
  individualFailCount: number
  /** A person can fail more than one check, so these don't have to sum to individualFailCount. */
  failBreakdown: { team: number; cohort: number; org: number }
  outliers: MassAdjustmentPersonOutcome[]
  /** Affected teams, then affected divisions, then DES-wide — empty when hasOrgData is false. */
  aggregateGroups: MassAdjustmentGroupCheck[]
  aggregateRequiresSignOff: boolean
  aggregateSignOffReasons: string[]
  routing: MassAdjustmentRouting
}

export interface MassAdjustmentCrossCheckInput {
  /** The eligible/affected population for this batch (already filtered to exclude anyone with an individual override — same exclusion Mass Adjustment already applies). */
  people: Person[]
  percent: number
  targets: Record<string, TargetRecord>
  snapshot: System2LiveSnapshot
  /** Full population, for the per-person checks' cohort peer lookups. */
  allPeople: Person[]
}

function proposedFinalTargetFor(person: Person, percent: number, targets: Record<string, TargetRecord>): { proposedFinalTarget: number; currentModelledTarget: number } {
  const currentModelledTarget = targets[person.id]?.modelled ?? 0
  const proposedFinalTarget = Math.round(currentModelledTarget * (1 + percent / 100))
  return { proposedFinalTarget, currentModelledTarget }
}

function computeGroupCheck(params: {
  key: string
  label: string
  level: 'team' | 'division' | 'org'
  before: { rollup: Rollup; risk: { status: RiskStatus } } | null
  afterRecords: OrgRecord[]
  seedKey: string
  goal?: number
}): MassAdjustmentGroupCheck {
  const { key, label, level, before, afterRecords, seedKey, goal } = params
  const afterRollup = aggregate(afterRecords).desWide
  const afterRisk = assessRisk(afterRollup, afterRecords, seedKey, goal)
  const beforeStatus = before?.risk.status ?? null
  // Same split as 3b: team/division are absolute (still add up sensibly),
  // only org is regression-aware (its wording explicitly calls out a
  // transition, see overrideCrossCheck.ts).
  const passes = level === 'org' ? stillSensible(beforeStatus, afterRisk.status) : isCompliant(afterRisk.status)
  const beforeTotal = before?.rollup.target ?? 0
  return {
    key,
    label,
    level,
    beforeHeadcount: before?.rollup.headcount ?? 0,
    afterHeadcount: afterRollup.headcount,
    beforeTotal,
    afterTotal: afterRollup.target,
    beforeStatus,
    afterStatus: afterRisk.status,
    status: passes ? 'pass' : 'fail',
    detail:
      beforeStatus === afterRisk.status
        ? `${label} stays ${afterRisk.status}: £${beforeTotal}k → £${afterRollup.target}k.`
        : `${label} moves from ${beforeStatus ?? 'no prior data'} to ${afterRisk.status}: £${beforeTotal}k → £${afterRollup.target}k.`,
  }
}

export function computeMassAdjustmentCrossCheck(input: MassAdjustmentCrossCheckInput): MassAdjustmentCrossCheckResult {
  const { people, percent, targets, snapshot, allPeople } = input

  const perPerson: MassAdjustmentPersonOutcome[] = people.map((person) => {
    const { proposedFinalTarget, currentModelledTarget } = proposedFinalTargetFor(person, percent, targets)
    return {
      person,
      individual: runOverrideCrossCheck({ person, proposedFinalTarget, currentModelledTarget, snapshot, people: allPeople }),
    }
  })

  const outliers = perPerson.filter((p) => p.individual.requiresSignOff)
  const individualFailCount = outliers.length
  const individualPassCount = perPerson.length - individualFailCount
  const failBreakdown = { team: 0, cohort: 0, org: 0 }
  for (const { individual } of perPerson) {
    if (individual.team?.status === 'fail') failBreakdown.team++
    if (individual.cohort?.status === 'fail') failBreakdown.cohort++
    if (individual.org?.status === 'fail') failBreakdown.org++
  }

  if (!snapshot.hasData || !snapshot.org) {
    return {
      hasOrgData: false,
      perPerson,
      individualPassCount,
      individualFailCount,
      failBreakdown,
      outliers,
      aggregateGroups: [],
      aggregateRequiresSignOff: false,
      aggregateSignOffReasons: [],
      routing: outliers.length > 0 ? 'outliers-only' : 'none',
    }
  }

  // Everyone's hypothetical change, built once, reused across the team,
  // division, and org aggregate computations below.
  const hypotheticalByPersonId = new Map<string, OrgRecord>()
  for (const person of people) {
    const { proposedFinalTarget, currentModelledTarget } = proposedFinalTargetFor(person, percent, targets)
    const proposedRevenue = proposedRevenueFor(person, proposedFinalTarget, currentModelledTarget)
    hypotheticalByPersonId.set(person.id, buildHypotheticalOrgRecord(person, proposedRevenue))
  }
  const affectedIds = new Set(hypotheticalByPersonId.keys())
  const affectedTeamKeys = new Set(people.map((p) => `${p.division}::${p.team}`))
  const affectedDivisions = new Set(people.map((p) => p.division))

  const aggregateGroups: MassAdjustmentGroupCheck[] = []

  for (const teamKey of affectedTeamKeys) {
    const [division, team] = teamKey.split('::') as [Division, string]
    const before = getTeamLiveState(snapshot, division, team)
    const otherRecords = snapshot.records.filter((r) => r.division === division && r.team === team && !affectedIds.has(r.id))
    const teamHypotheticals = people.filter((p) => p.division === division && p.team === team).map((p) => hypotheticalByPersonId.get(p.id)!)
    aggregateGroups.push(
      computeGroupCheck({
        key: teamKey,
        label: `Team ${division} / ${team}`,
        level: 'team',
        before,
        afterRecords: [...otherRecords, ...teamHypotheticals],
        seedKey: teamKey,
      }),
    )
  }

  for (const division of affectedDivisions) {
    const before = getDivisionLiveState(snapshot, division)
    const otherRecords = snapshot.records.filter((r) => r.division === division && !affectedIds.has(r.id))
    const divisionHypotheticals = people.filter((p) => p.division === division).map((p) => hypotheticalByPersonId.get(p.id)!)
    aggregateGroups.push(
      computeGroupCheck({
        key: division,
        label: `Division ${division}`,
        level: 'division',
        before,
        afterRecords: [...otherRecords, ...divisionHypotheticals],
        seedKey: division,
      }),
    )
  }

  const orgOtherRecords = snapshot.records.filter((r) => !affectedIds.has(r.id))
  const orgAfterRecords = [...orgOtherRecords, ...people.map((p) => hypotheticalByPersonId.get(p.id)!)]
  aggregateGroups.push(
    computeGroupCheck({
      key: 'des-wide',
      label: 'DES-wide',
      level: 'org',
      before: snapshot.org,
      afterRecords: orgAfterRecords,
      seedKey: 'DES-wide',
      goal: snapshot.org.goal,
    }),
  )

  const failedGroups = aggregateGroups.filter((g) => g.status === 'fail')
  const aggregateRequiresSignOff = failedGroups.length > 0
  const aggregateSignOffReasons = failedGroups.map((g) => `${g.label}: ${g.detail}`)

  const routing: MassAdjustmentRouting = aggregateRequiresSignOff ? 'whole-batch' : outliers.length > 0 ? 'outliers-only' : 'none'

  return {
    hasOrgData: true,
    perPerson,
    individualPassCount,
    individualFailCount,
    failBreakdown,
    outliers,
    aggregateGroups,
    aggregateRequiresSignOff,
    aggregateSignOffReasons,
    routing,
  }
}
