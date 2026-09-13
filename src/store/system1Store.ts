import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SEED_PEOPLE } from '../system1/data/people'
import { calculateModelledTarget } from '../system1/engine/targetingEngine'

/**
 * System 1's shared store. Population data (src/system1/data/people.ts) is
 * static reference data, never persisted or mutated — this store only holds
 * the *stateful* part: one TargetRecord per person, keyed by id.
 *
 * M0's placeholder demoValue is gone. This is the real foundation M4-M11
 * build on: overrides (M8), status transitions (M11), etc. all mutate
 * `targets`, never `people`.
 */

export type TargetStatus = 'Modelled' | 'Adjusted' | 'Proposed' | 'Approved'

export interface TargetRecord {
  personId: string
  status: TargetStatus
  /** Computed by the M2 engine from the person's locked input factors. */
  modelled: number
  rangeLow: number
  rangeHigh: number
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
    targets[person.id] = { personId: person.id, status: 'Modelled', modelled, rangeLow, rangeHigh }
  }
  return targets
}

interface System1State {
  targets: Record<string, TargetRecord>
  resetToSeed: () => void
}

export const useSystem1Store = create<System1State>()(
  persist(
    (set) => ({
      targets: buildSeedTargets(),
      resetToSeed: () => set({ targets: buildSeedTargets() }),
    }),
    { name: 'des-system1' },
  ),
)
