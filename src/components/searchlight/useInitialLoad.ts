import { useEffect, useState } from 'react'

/**
 * The shared searchlight loading-state pattern (Searchlight design pass) —
 * shows the loader for ~0.9s on a screen's initial load, then reveals
 * content. Gated on `active` (typically records.length > 0) so screens with
 * nothing to scan skip straight to their empty state, matching Executive
 * Summary's own behaviour.
 */
export function useInitialLoad(active: boolean): boolean {
  const [loading, setLoading] = useState(active)
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(timer)
  }, [active])
  return loading
}
