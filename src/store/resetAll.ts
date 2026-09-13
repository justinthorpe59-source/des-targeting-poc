import { useSystem1Store } from './system1Store'
import { useSystem2Store } from './system2Store'

/**
 * The single "Reset all demo data" control lives in the app shell (not
 * buried in either system) and resets every system's store back to its
 * seed defaults. zustand's persist middleware re-writes localStorage as
 * soon as state changes, so this also overwrites both persisted keys —
 * a hard refresh afterwards won't resurrect the old values.
 */
export function resetAllDemoData() {
  useSystem1Store.getState().resetToSeed()
  useSystem2Store.getState().resetToSeed()
}
