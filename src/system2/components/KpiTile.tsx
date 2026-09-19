import type { ReactNode } from 'react'
import SpotlightCard from '../../components/react-bits/SpotlightCard'

/**
 * S2-M10: shared KPI tile for System 2's card-based screens (Executive
 * summary, Scenario workspace) — extracted from Scenario workspace's own
 * local KpiCard (S2-M7) rather than duplicating the same SpotlightCard
 * wrapping in Executive Summary too. `value` takes a ReactNode (not just a
 * string) so a caller can pass a <CountUp> element where that's wanted —
 * kept as an explicit per-call-site choice rather than baked into this
 * component, since a live-updating value (Scenario workspace's own tiles
 * recompute on every lever tweak) must never be animated: CountUp's spring
 * animation would make an immediate read return a mid-animation value
 * instead of the settled one, same reasoning System 1's M14 used to keep
 * CountUp off Mass Adjustment's live preview.
 */
export function KpiTile({ label, value, sub, testId }: { label: string; value: ReactNode; sub?: string; testId?: string }) {
  return (
    <SpotlightCard className="rounded-lg border border-pa-grey-01 bg-pa-white p-3" spotlightColor="rgba(2, 77, 120, 0.08)">
      <div className="font-pa-body text-xs font-medium uppercase tracking-wide text-pa-grey-03">{label}</div>
      <div data-testid={testId} className="mt-1 font-pa-mono text-xl font-bold tabular-nums text-pa-grey-04">
        {value}
      </div>
      {sub && <div className="mt-0.5 font-pa-body text-xs text-pa-grey-03">{sub}</div>}
    </SpotlightCard>
  )
}
