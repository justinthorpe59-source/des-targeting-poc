import { useMemo } from 'react'
import { useSystem2Store } from '../../store/system2Store'
import { computeSystem2LiveSnapshot, type System2LiveSnapshot } from './liveOrgState'

/**
 * The only two functions System 1 code should ever call to read System 2's
 * live aggregate state. Both are thin: they read useSystem2Store and hand
 * off to the pure snapshot builder in liveOrgState.ts — this file's only
 * job is bridging that store to a read. Neither exposes System 2's setters
 * (importSnapshot, resetToSeed) in any way, so there is no path from here
 * for System 1 to write back into System 2's state; the existing one-way
 * Snapshot Export -> Import flow (buildSnapshot.ts / ingestSnapshot.ts)
 * stays the only way data moves from System 1 into System 2, unchanged.
 */

/** Imperative, point-in-time read for use outside React — event handlers, validation logic before an action is applied, debug/verification. Calls useSystem2Store.getState() fresh every time, so it never returns a stale cached value. */
export function getSystem2LiveSnapshot(): System2LiveSnapshot {
  const { records, importedAt } = useSystem2Store.getState()
  return computeSystem2LiveSnapshot(records, importedAt)
}

/** Reactive hook variant for components that need to re-render as System 2's state changes (e.g. a live cross-check panel). */
export function useSystem2LiveSnapshot(): System2LiveSnapshot {
  const records = useSystem2Store((state) => state.records)
  const importedAt = useSystem2Store((state) => state.importedAt)
  return useMemo(() => computeSystem2LiveSnapshot(records, importedAt), [records, importedAt])
}
