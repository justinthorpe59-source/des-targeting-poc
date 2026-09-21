import type { SignOffContext } from '../../store/system1Store'
import type { OverrideCrossCheckResult } from './overrideCrossCheck'
import type { MassAdjustmentCrossCheckResult } from './massAdjustmentCrossCheck'

/**
 * Batch 3d: turns 3b's/3c's already-computed cross-check results into the
 * frozen SignOffContext a TargetRecord carries into the Sign-off Queue —
 * copying fields over, never recomputing anything the checks already
 * worked out. One function per source, since the two result shapes differ
 * (a single person's checks vs. a whole batch's).
 */

export function buildIndividualSignOffContext(result: OverrideCrossCheckResult): SignOffContext {
  return {
    source: 'individual',
    reasons: result.signOffReasons,
    isDrasticChange: result.isDrasticChange,
    team: result.team ? { status: result.team.status, detail: result.team.detail } : null,
    cohort: result.cohort ? { status: result.cohort.status, detail: result.cohort.detail } : null,
    org: result.org ? { status: result.org.status, detail: result.org.detail } : null,
  }
}

/**
 * One SignOffContext per outlier/affected person in the batch — same
 * batchId for all of them, so the Sign-off Queue can group them into one
 * entry. Only called for the people who actually ended up Pending Sign-off
 * (the whole batch when the aggregate failed, or just the outliers when it
 * didn't) — the screen decides who that is from massResult.routing, same
 * as it already does for applyMassAdjustment's signOffPersonIds.
 */
export function buildMassSignOffContext(massResult: MassAdjustmentCrossCheckResult, batchId: string): Record<string, SignOffContext> {
  const aggregateGroups = massResult.aggregateGroups.map((g) => ({ key: g.key, label: g.label, status: g.status, detail: g.detail }))

  const contextByPersonId: Record<string, SignOffContext> = {}
  for (const { person, individual } of massResult.perPerson) {
    contextByPersonId[person.id] = {
      source: 'mass',
      batchId,
      reasons: individual.signOffReasons,
      isDrasticChange: individual.isDrasticChange,
      team: individual.team ? { status: individual.team.status, detail: individual.team.detail } : null,
      cohort: individual.cohort ? { status: individual.cohort.status, detail: individual.cohort.detail } : null,
      org: individual.org ? { status: individual.org.status, detail: individual.org.detail } : null,
      aggregateGroups,
      batchIndividualPassCount: massResult.individualPassCount,
      batchIndividualFailCount: massResult.individualFailCount,
      batchSize: massResult.perPerson.length,
    }
  }
  return contextByPersonId
}
