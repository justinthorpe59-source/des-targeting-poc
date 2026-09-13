/**
 * The single implementation of the locked targeting formula. Every consumer
 * — Overview totals, Individual Detail, Cohort comparison, the What-if
 * sandbox (M7), Mass adjustment previews (M10) — calls this same function.
 * There is no second copy of this arithmetic anywhere in the codebase.
 *
 * modelled target = cohort baseline x capacity factor x role factor x
 * economic factor, expressed as a range: modelled +/- 15% (both locked in
 * CLAUDE.md). "Capacity factor" is the person's capacity value used
 * directly — there's no separate capacity-to-factor lookup, capacity IS the
 * multiplier.
 *
 * Pure function: same inputs in, same output out, always. No RNG, no
 * lookups outside its arguments, no hidden state — so "recalculate the same
 * record twice, get the same answer" holds by construction, and the What-if
 * sandbox can call this with hypothetical numbers that were never written to
 * any stored Person record.
 */

export const TARGET_RANGE_BAND = 0.15

export interface TargetInputs {
  baseline: number
  capacity: number
  roleFactor: number
  economicFactor: number
}

export interface ModelledTarget {
  /** Full-precision result, pre-rounding. Kept for callers that need exact math (e.g. cohort averages). */
  raw: number
  /** Rounded to the nearest £1k for display — CLAUDE.md's own "range, not false precision" principle applied to the point estimate too. */
  modelled: number
  rangeLow: number
  rangeHigh: number
}

/** Values are already denominated in £k (baseline is e.g. 92 for £92k), so rounding to the nearest whole number rounds to the nearest £1k. */
function roundToNearestK(value: number): number {
  return Math.round(value)
}

export function calculateModelledTarget(inputs: TargetInputs): ModelledTarget {
  const raw = inputs.baseline * inputs.capacity * inputs.roleFactor * inputs.economicFactor
  const modelled = roundToNearestK(raw)
  return {
    raw,
    modelled,
    rangeLow: roundToNearestK(raw * (1 - TARGET_RANGE_BAND)),
    rangeHigh: roundToNearestK(raw * (1 + TARGET_RANGE_BAND)),
  }
}
