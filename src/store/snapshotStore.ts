import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Snapshot } from '../system1/engine/buildSnapshot'

/**
 * The bridge between System 1 and System 2. This is the ONLY place System 2
 * will ever read exported data from (once S2-M1 exists) — its own
 * localStorage key, entirely separate from system1Store. System 2's future
 * code has no import path to system1Store at all, so "must never read
 * System 1's live data directly" is a structural fact, not a convention
 * anyone could accidentally break by wiring a convenient shared selector.
 *
 * Only written by an explicit Export click (src/system1/screens/
 * OverviewPopulation.tsx's System 2 sync strip) — never auto-synced from system1Store's live state.
 */
interface SnapshotState {
  lastSnapshot: Snapshot | null
  setSnapshot: (snapshot: Snapshot) => void
  clearSnapshot: () => void
}

export const useSnapshotStore = create<SnapshotState>()(
  persist(
    (set) => ({
      lastSnapshot: null,
      setSnapshot: (snapshot) => set({ lastSnapshot: snapshot }),
      clearSnapshot: () => set({ lastSnapshot: null }),
    }),
    { name: 'des-snapshot' },
  ),
)
