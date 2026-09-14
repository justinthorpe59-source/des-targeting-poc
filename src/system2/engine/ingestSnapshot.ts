import type { Snapshot } from '../../system1/engine/buildSnapshot'
import { CAPACITY_UTILISATION_RANGE, TEAM_HISTORICAL_TREND_RANGE, type OrgRecord } from '../data/types'
import { mulberry32, randRange, seedFromId } from './prng'

/**
 * S2-M1: the only place a Snapshot becomes System 2's own OrgRecord[]. Pure
 * function — same snapshot in, same OrgRecord[] out, every time. Each
 * record's capacityUtilisation/teamHistoricalTrend is seeded from that
 * person's id specifically (not a single seed walked across the list), so
 * the same person gets the same values on any import that includes them,
 * regardless of who else is in the snapshot or the order they appear in.
 *
 * One snapshot record in -> exactly one OrgRecord out. No drops, no
 * duplicates, by construction (a straight map, not a filter or a merge).
 */
export function ingestSnapshot(snapshot: Snapshot): OrgRecord[] {
  return snapshot.records.map((record) => {
    const rng = mulberry32(seedFromId(record.id))
    return {
      ...record,
      capacityUtilisation: round2(randRange(rng, ...CAPACITY_UTILISATION_RANGE)),
      teamHistoricalTrend: round2(randRange(rng, ...TEAM_HISTORICAL_TREND_RANGE)),
    }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
