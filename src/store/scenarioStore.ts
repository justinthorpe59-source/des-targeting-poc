import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ScenarioLevers } from '../system2/engine/scenario'

/**
 * S2-M7: Scenario workspace's "Save scenario" action lives here, in its own
 * store (own localStorage key, same per-system-own-key convention as
 * system2Store/snapshotStore) — separate from system2Store because a saved
 * scenario is demo-authoring state, not imported data.
 *
 * Only the lever *config* is persisted, never computed results — S2-M8's
 * "reopened later, shows exactly the same result" acceptance signal holds
 * for free by replaying the same config through runScenario() again, the
 * same pure function every time, rather than trusting a stale snapshot of
 * numbers to still be correct.
 *
 * Scenario library (S2-M8) is the browsing/reopen/compare screen over what
 * this store holds — it doesn't own saving itself, same as Individual
 * Detail (not a separate screen) owns Approve in System 1.
 */
export interface SavedScenario {
  id: string
  name: string
  savedAt: string
  levers: ScenarioLevers
}

interface ScenarioState {
  scenarios: SavedScenario[]
  saveScenario: (name: string, levers: ScenarioLevers) => void
  deleteScenario: (id: string) => void
  resetToSeed: () => void
}

export const useScenarioStore = create<ScenarioState>()(
  persist(
    (set) => ({
      scenarios: [],
      saveScenario: (name, levers) =>
        set((state) => ({
          scenarios: [
            ...state.scenarios,
            { id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), levers },
          ],
        })),
      deleteScenario: (id) => set((state) => ({ scenarios: state.scenarios.filter((s) => s.id !== id) })),
      resetToSeed: () => set({ scenarios: [] }),
    }),
    { name: 'des-scenarios' },
  ),
)
