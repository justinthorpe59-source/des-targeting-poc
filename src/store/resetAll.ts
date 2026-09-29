import { useSystem1Store } from './system1Store'
import { useSystem2Store } from './system2Store'
import { useSnapshotStore } from './snapshotStore'
import { useScenarioStore } from './scenarioStore'
import { forgetSplashSeen } from '../shared/splashSession'

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

/**
 * The harder reset behind the shell's Searchlight wordmark: put the data back
 * AND return to the splash, so the POC is in the state it would be in if it
 * had just been opened.
 *
 * The difference from resetAllDemoData() is the session: that one deliberately
 * leaves the splash flag alone so a mid-demo data reset doesn't eject the
 * presenter, whereas this one is the "start again from the top" control and
 * clears it.
 *
 * It finishes with a full page load rather than a React state change. The
 * stores reset in memory first so zustand's persist middleware writes the seed
 * values to localStorage, and the reload then rehydrates from those — which
 * makes this a genuine fresh start rather than a screen change with old state
 * still sitting underneath.
 */
export function restartDemo() {
  resetAllDemoData()
  forgetSplashSeen()
  window.location.assign('/')
}
