import { useSystem1Store } from '../store/system1Store'
import { useSystem2Store } from '../store/system2Store'

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
    }
  }
}

export function exposeStoresForTesting() {
  if (import.meta.env.DEV) {
    window.__DES_DEBUG__ = { system1: useSystem1Store, system2: useSystem2Store }
  }
}
