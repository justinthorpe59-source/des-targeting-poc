import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Snapshot } from '../system1/engine/buildSnapshot'
import { ingestSnapshot } from '../system2/engine/ingestSnapshot'
import type { OrgRecord } from '../system2/data/types'

/**
 * System 2's shared store. S2-M0's demoValue placeholder is gone — this is
 * the real foundation S2-M2 onward build on, same move M3 made for
 * system1Store. Holds only what an explicit Import produced; never reads
 * snapshotStore reactively, so a later change to System 1's data (or even a
 * fresh Export) has zero effect here until Import is clicked again.
 */

interface System2State {
  records: OrgRecord[]
  importedAt: string | null
  /** Full replace, not a merge — re-importing overwrites the prior set entirely. Trivially satisfies "no drops, no duplicates": a straight map in ingestSnapshot(), then a full swap here. */
  importSnapshot: (snapshot: Snapshot) => void
  resetToSeed: () => void
}

export const useSystem2Store = create<System2State>()(
  persist(
    (set) => ({
      records: [],
      importedAt: null,
      importSnapshot: (snapshot) =>
        set({ records: ingestSnapshot(snapshot), importedAt: new Date().toISOString() }),
      resetToSeed: () => set({ records: [], importedAt: null }),
    }),
    { name: 'des-system2' },
  ),
)
