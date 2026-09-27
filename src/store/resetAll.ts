import { useSystem1Store } from './system1Store'
import { useSystem2Store } from './system2Store'
import { useSnapshotStore } from './snapshotStore'
import { useScenarioStore } from './scenarioStore'

/**
 * The single "Reset all demo data" control lives in the app shell (not
 * buried in either system) and resets every system's store back to its
 * seed defaults. zustand's persist middleware re-writes localStorage as
 * soon as state changes, so this also overwrites all four persisted keys —
 * a hard refresh afterwards won't resurrect the old values.
 *
 * Changed 27 Sept 2026: System 2's reset now restores its PRE-IMPORTED seed
 * rather than emptying it. CLAUDE.md describes this control as clearing
 * System 2's imported snapshot; that wording predates System 2 having a
 * seed at all, and emptying it would drop the demo onto a blocked screen —
 * the opposite of what a reset is for. `snapshotStore` (the export staging
 * area, which is genuinely transient) is still cleared.
 */
export function resetAllDemoData() {
  useSystem1Store.getState().resetToSeed()
  useSystem2Store.getState().resetToSeed()
  useSnapshotStore.getState().clearSnapshot()
  useScenarioStore.getState().resetToSeed()
}
