import type { SnapshotRecord } from '../../system1/engine/buildSnapshot'

/**
 * System 2's own internal record. Extends the shared data contract
 * (SnapshotRecord — imported as a type only, so this file has zero runtime
 * dependency on System 1) with System 2's own locked dataset additions,
 * generated once at ingestion (S2-M1) rather than mixed into later
 * aggregation logic.
 */

/** Locked: random 0.75-1.05 per record. Feeds the expected-achievement formula. */
export const CAPACITY_UTILISATION_RANGE = [0.75, 1.05] as const

/** Locked: random 0.85-1.05 per record. */
export const TEAM_HISTORICAL_TREND_RANGE = [0.85, 1.05] as const

export interface OrgRecord extends SnapshotRecord {
  capacityUtilisation: number
  teamHistoricalTrend: number
}
