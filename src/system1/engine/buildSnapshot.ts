import { GRADES, type Division, type Location, type Person } from '../data/types'
import type { TargetRecord } from '../../store/system1Store'
import { combinedRevenueFor } from './revenueEngine'

/**
 * The locked snapshot schema (M13). Deliberately lean — only what System 2
 * actually needs (division/team/location for aggregation, the combined
 * revenue value, grade for context) plus enough to trace a record back to
 * System 1 if ever needed (id, approvedAt). No name — confirmed with the
 * user: System 2 is org-level only and never displays an individual, so
 * carrying a name across the hand-off is unnecessary PII exposure. No
 * modelled value, range, or override detail — that's System 1's internal
 * working, not something System 2's aggregation needs.
 *
 * gradeCode/roleTitle keep their original shape (a 1-based ladder index and
 * a display string) so System 2's schema and screens don't need to know the
 * grade ladder changed underneath.
 */
export interface SnapshotRecord {
  id: string
  division: Division
  team: string
  location: Location
  gradeCode: number
  roleTitle: string
  /** £k combined revenue (billable + sales-target, where applicable) — this is the "Target" System 2's expected-achievement formula multiplies against. */
  target: number
  approvedAt: string
}

export interface Snapshot {
  exportedAt: string
  sourceSystem: string
  recordCount: number
  records: SnapshotRecord[]
}

export const SNAPSHOT_SOURCE_SYSTEM = 'System 1 — Individual Targeting'

/**
 * Builds a snapshot from the current population + targets. Only Approved
 * records are included — this is the one place that filter is enforced,
 * so the export screen and any future S2-M1 ingestion code agree on what
 * "the snapshot" means without re-deriving it.
 */
export function buildSnapshot(people: Person[], targets: Record<string, TargetRecord>): Snapshot {
  const records: SnapshotRecord[] = []
  for (const person of people) {
    const target = targets[person.id]
    if (!target || target.status !== 'Approved') continue
    records.push({
      id: person.id,
      division: person.division,
      team: person.team,
      location: person.location,
      gradeCode: GRADES.indexOf(person.grade) + 1,
      roleTitle: person.grade,
      target: combinedRevenueFor(person),
      approvedAt: target.approvedAt ?? '',
    })
  }
  return {
    exportedAt: new Date().toISOString(),
    sourceSystem: SNAPSHOT_SOURCE_SYSTEM,
    recordCount: records.length,
    records,
  }
}
