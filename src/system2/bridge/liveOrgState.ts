import type { Division } from '../../system1/data/types'
import { aggregate, type AggregationResult, type Rollup } from '../engine/aggregation'
import { computeRiskStatuses, type RiskAssessment, type RiskStatusResult } from '../engine/riskStatus'
import type { OrgRecord } from '../data/types'

/**
 * Batch 3a: the read-only bridge System 1 uses to see System 2's live
 * aggregate state, per locked-spec.md's real-time cross-check requirement.
 *
 * Pure, store-free by design — same reasoning as aggregation.ts/riskStatus.ts
 * staying free of any Zustand import: it keeps this file testable directly
 * from a verify-*.ts script (no localStorage, no persist middleware to
 * stand up) and, more importantly, keeps System 1 from ever touching System
 * 2's store setters. useSystem2LiveState.ts (the thin store-reading wrapper
 * actual app code calls) is the only file that imports useSystem2Store —
 * this one never does, so there is nothing here to write through even by
 * accident.
 *
 * Never recomputes System 2's numbers a second, possibly-drifting way — it
 * calls the exact same aggregate()/computeRiskStatuses() System 2's own
 * screens call, on the exact same records. "Live" comes from being called
 * fresh each time (see useSystem2LiveState.ts), not from any caching here.
 */

/** A team's or division's own rollup, risk assessment, and the records that produced them. Team/division status is never apportioned from the org goal — each compares against its own allocated target, per the locked rule (see riskStatus.ts) — so "portion of the org goal" is this group's own rollup.target. */
export interface GroupLiveState {
  rollup: Rollup
  risk: RiskAssessment
  /** This group's own records only, frozen. Exposed (not just the rollup/risk summary) because a what-if check needs to re-run assessRisk() against a hypothetically-modified rollup — concentration and max-feasible-capacity both depend on the individual records, not just their sums. */
  records: readonly Readonly<OrgRecord>[]
}

export interface OrgLiveState {
  goal: number
  rollup: Rollup
  risk: RiskAssessment
}

export interface System2LiveSnapshot {
  /** false when System 2 has never imported a snapshot — every accessor below returns null against a snapshot like this, by construction, rather than throwing. */
  hasData: boolean
  importedAt: string | null
  org: OrgLiveState | null
  aggregation: AggregationResult | null
  riskStatuses: RiskStatusResult | null
  records: readonly Readonly<OrgRecord>[]
}

function freezeRecords(records: OrgRecord[]): readonly Readonly<OrgRecord>[] {
  return Object.freeze(records.map((record) => Object.freeze({ ...record })))
}

/**
 * Pure snapshot builder: same records/importedAt in, same snapshot out,
 * every time. The wrapper in useSystem2LiveState.ts calls this fresh on
 * every read — that's what makes reads "live" rather than a stale cache.
 */
export function computeSystem2LiveSnapshot(records: OrgRecord[], importedAt: string | null): System2LiveSnapshot {
  const frozenRecords = freezeRecords(records)

  if (records.length === 0) {
    return { hasData: false, importedAt, org: null, aggregation: null, riskStatuses: null, records: frozenRecords }
  }

  const aggregation = aggregate(records)
  const riskStatuses = computeRiskStatuses(records, aggregation)

  return {
    hasData: true,
    importedAt,
    org: { goal: aggregation.desWide.target, rollup: aggregation.desWide, risk: riskStatuses.desWide },
    aggregation,
    riskStatuses,
    records: frozenRecords,
  }
}

/** Org-wide goal, current allocated total (rollup.target), and current forecast/gap (derivable from rollup.expectedAchievement vs goal) — null when System 2 has no data yet. */
export function getOrgLiveState(snapshot: System2LiveSnapshot): OrgLiveState | null {
  return snapshot.org
}

/** A given team's current total and status — null if the team doesn't exist in System 2's current data (including "no data at all yet"). */
export function getTeamLiveState(snapshot: System2LiveSnapshot, division: Division, team: string): GroupLiveState | null {
  if (!snapshot.hasData || !snapshot.aggregation || !snapshot.riskStatuses) return null
  const key = `${division}::${team}`
  const rollup = snapshot.aggregation.byTeam.get(key)
  const risk = snapshot.riskStatuses.byTeam.get(key)
  if (!rollup || !risk) return null
  return { rollup, risk, records: snapshot.records.filter((r) => r.division === division && r.team === team) }
}

/** The division a given team rolls into — its current total and status. Null under the same conditions as getTeamLiveState(). */
export function getDivisionLiveState(snapshot: System2LiveSnapshot, division: Division): GroupLiveState | null {
  if (!snapshot.hasData || !snapshot.aggregation || !snapshot.riskStatuses) return null
  const rollup = snapshot.aggregation.byDivision.get(division)
  const risk = snapshot.riskStatuses.byDivision.get(division)
  if (!rollup || !risk) return null
  return { rollup, risk, records: snapshot.records.filter((r) => r.division === division) }
}
