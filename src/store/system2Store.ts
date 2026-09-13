import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * System 2's shared store. Stubbed at M0 purely to establish the pattern
 * S2-M0 builds on: its own state, its own localStorage key ("des-system2"),
 * never reading System 1's live data — only the M13 snapshot export, later.
 */

const SEED_DEMO_VALUE = 0

interface System2State {
  demoValue: number
  setDemoValue: (value: number) => void
  resetToSeed: () => void
}

export const useSystem2Store = create<System2State>()(
  persist(
    (set) => ({
      demoValue: SEED_DEMO_VALUE,
      setDemoValue: (value) => set({ demoValue: value }),
      resetToSeed: () => set({ demoValue: SEED_DEMO_VALUE }),
    }),
    { name: 'des-system2' },
  ),
)
