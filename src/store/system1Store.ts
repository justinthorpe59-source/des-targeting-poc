import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * System 1's shared store. Real fields (population, targets, overrides, etc.)
 * land starting M1 — for M0 this only proves the plumbing: a value that's
 * shared across screens, persisted to localStorage, and resettable to seed.
 */

const SEED_DEMO_VALUE = 0

interface System1State {
  demoValue: number
  setDemoValue: (value: number) => void
  resetToSeed: () => void
}

export const useSystem1Store = create<System1State>()(
  persist(
    (set) => ({
      demoValue: SEED_DEMO_VALUE,
      setDemoValue: (value) => set({ demoValue: value }),
      resetToSeed: () => set({ demoValue: SEED_DEMO_VALUE }),
    }),
    { name: 'des-system1' },
  ),
)
