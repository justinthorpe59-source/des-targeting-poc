import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SEED_PEOPLE } from '../system1/data/people'
import { calculateModelledTarget } from '../system1/engine/targetingEngine'

/**
 * System 1's shared store. Population data (src/system1/data/people.ts) is
 * static reference data, never persisted or mutated — this store only holds
 * the *stateful* part: one TargetRecord per person, keyed by id, plus a
 * shared audit log.
 *
 * M0's placeholder demoValue is gone. This is the real foundation M6-M11
 * build on: overrides (M8), status transitions (M11), etc. all mutate
 * `targets` and append to `auditLog`, never `people`.
 */

export type TargetStatus = 'Modelled' | 'Adjusted' | 'Proposed' | 'Approved'

export interface TargetRecord {
  personId: string
  status: TargetStatus
  /** Computed by the M2 engine from the person's locked input factors. */
  modelled: number
  rangeLow: number
  rangeHigh: number
  /**
   * Freeform manager notes (strengths, interests, goals). Editing lands at
   * M8 ("Manager override (personal notes, reason, final say)") — until
   * then this is always empty, and Individual Detail (M5) displays that
   * honestly rather than faking content.
   */
  notes: string
}

/**
 * Full history across all records, "who, what, when, why" — Individual
 * Detail (M5) filters this by personId for its own change-history section;
 * a later Audit screen reads the whole array unfiltered. Nothing appends to
 * this until M8/M10/M11 exist, so it's correctly empty right now, not
 * placeholder content.
 */
export interface ChangeLogEntry {
  id: string
  personId: string
  timestamp: string
  actor: string
  action: string
  detail: string
}

function buildSeedTargets(): Record<string, TargetRecord> {
  const targets: Record<string, TargetRecord> = {}
  for (const person of SEED_PEOPLE) {
    const { modelled, rangeLow, rangeHigh } = calculateModelledTarget({
      baseline: person.baseline,
      capacity: person.capacity,
      roleFactor: person.roleFactor,
      economicFactor: person.economicFactor,
    })
    targets[person.id] = { personId: person.id, status: 'Modelled', modelled, rangeLow, rangeHigh, notes: '' }
  }
  return targets
}

interface System1State {
  targets: Record<string, TargetRecord>
  auditLog: ChangeLogEntry[]
  resetToSeed: () => void
  addAuditEntry: (entry: Omit<ChangeLogEntry, 'id' | 'timestamp'>) => void
}

export const useSystem1Store = create<System1State>()(
  persist(
    (set) => ({
      targets: buildSeedTargets(),
      auditLog: [],
      resetToSeed: () => set({ targets: buildSeedTargets(), auditLog: [] }),
      addAuditEntry: (entry) =>
        set((state) => ({
          auditLog: [
            ...state.auditLog,
            { ...entry, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
          ],
        })),
    }),
    { name: 'des-system1' },
  ),
)
