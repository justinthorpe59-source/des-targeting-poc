import { useSystem1Store } from '../store/system1Store'
import { useSystem2Store } from '../store/system2Store'
import { useSnapshotStore } from '../store/snapshotStore'
import { useScenarioStore } from '../store/scenarioStore'
import { getSystem2LiveSnapshot } from '../system2/bridge/useSystem2LiveState'
import { getDivisionLiveState, getOrgLiveState, getTeamLiveState } from '../system2/bridge/liveOrgState'

/**
 * Dev-only: exposes the zustand stores on window so Playwright (or manual
 * QA) can mutate state directly and prove a screen reacts live, before real
 * UI exists to trigger that change (e.g. before M8 adds the override
 * screen, this is the only way to move a person to 'Adjusted' and watch
 * Overview update). Guarded by import.meta.env.DEV, which Vite statically
 * replaces with `false` in production builds — this call is dead code and
 * stripped, not shipped.
 */
declare global {
  interface Window {
    __DES_DEBUG__?: {
      system1: typeof useSystem1Store
      system2: typeof useSystem2Store
      snapshot: typeof useSnapshotStore
      scenario: typeof useScenarioStore
      /** Batch 3a: the same read-only bridge System 1 code calls, exposed here so a manual/Playwright check can read "System 1's side" of it directly and compare against System 2's own screens. */
      bridge: {
        getSystem2LiveSnapshot: typeof getSystem2LiveSnapshot
        getTeamLiveState: typeof getTeamLiveState
        getDivisionLiveState: typeof getDivisionLiveState
        getOrgLiveState: typeof getOrgLiveState
      }
    }
  }
}

export function exposeStoresForTesting() {
  if (import.meta.env.DEV) {
    window.__DES_DEBUG__ = {
      system1: useSystem1Store,
      system2: useSystem2Store,
      snapshot: useSnapshotStore,
      scenario: useScenarioStore,
      bridge: { getSystem2LiveSnapshot, getTeamLiveState, getDivisionLiveState, getOrgLiveState },
    }
  }
}
