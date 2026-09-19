import { useEffect, useState } from 'react'
import type { RiskStatus } from '../engine/riskStatus'
import { round1 } from '../riskDisplay'

/**
 * Signature visualisation for Executive Summary's gap/forecast "key moment"
 * (Searchlight design direction) — a horizontal coverage track, not a chart-
 * library gauge. One full-width band = the goal; the Aqua fill = forecast
 * (expected achievement) as a share of goal; the shortfall is drawn as a
 * hatched Ingenuity-Red segment between the forecast edge and the goal
 * marker, labelled directly on the band in the numeric/data face. Purpose-
 * built for "coverage vs forecast", so it reads as a designed composition
 * rather than a default donut.
 *
 * It reads the same expected/goal/gap the KPI strip renders — a second view
 * of those figures, never a new calculation, so the two can't disagree.
 *
 * Fill grows in on mount with a plain CSS width transition (native, no
 * animation library); static under prefers-reduced-motion via the global
 * guard in src/index.css.
 */
export function CoverageTrack({
  goal,
  expected,
  gap,
  status,
}: {
  goal: number
  expected: number
  gap: number
  status: RiskStatus
}) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const forecastPct = goal > 0 ? (expected / goal) * 100 : 0
  // Axis runs 0 → max(100, forecast) so the goal marker is always on-band,
  // whether we're short of goal or (surplus case) beyond it.
  const axisMax = Math.max(100, forecastPct)
  const pos = (v: number) => (v / axisMax) * 100
  const fillPos = pos(forecastPct)
  const goalPos = pos(100)
  const shortfall = gap > 0
  const surplus = gap < 0
  const hatch =
    'repeating-linear-gradient(-45deg, rgba(246,43,68,0.6) 0 1.5px, rgba(246,43,68,0.08) 1.5px 8px)'

  return (
    <div data-testid="s2-exec-coverage-track">
      <div className="mb-2 flex items-baseline justify-between font-pa-body text-xs text-pa-grey-03">
        <span>Forecast coverage of goal</span>
        <span className="font-pa-mono">axis 0–{round1(axisMax)}%</span>
      </div>

      <div className="relative h-16 w-full overflow-hidden rounded-lg bg-pa-grey-01" data-status={status}>
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-end pr-3 transition-[width] duration-[1000ms] ease-out"
          style={{
            width: `${drawn ? fillPos : 0}%`,
            background: 'linear-gradient(90deg, var(--color-pa-aqua-04), var(--color-pa-aqua-03))',
          }}
        >
          <span className="whitespace-nowrap font-pa-mono text-sm font-bold text-pa-white">£{round1(expected)}k</span>
        </div>

        {shortfall && (
          <div
            className="absolute inset-y-0 flex items-center justify-center"
            style={{ left: `${fillPos}%`, width: `${goalPos - fillPos}%`, background: hatch }}
          >
            <span className="whitespace-nowrap font-pa-mono text-xs font-bold text-pa-ingenuity-red">
              −£{round1(gap)}k
            </span>
          </div>
        )}

        {surplus && (
          <div
            className="absolute inset-y-0"
            style={{ left: `${goalPos}%`, width: `${fillPos - goalPos}%`, background: 'var(--color-pa-lime-02)' }}
          />
        )}

        <div className="absolute inset-y-0 w-0.5 bg-pa-grey-04" style={{ left: `${goalPos}%` }} />
      </div>

      <div className="mt-2 flex items-baseline justify-between font-pa-body text-xs">
        <span className="text-pa-aqua-05">
          Forecast <span className="font-pa-mono font-semibold">{round1(forecastPct)}%</span>
        </span>
        <span className="text-pa-grey-04">
          Goal <span className="font-pa-mono font-semibold">£{round1(goal)}k</span>
        </span>
      </div>
    </div>
  )
}
