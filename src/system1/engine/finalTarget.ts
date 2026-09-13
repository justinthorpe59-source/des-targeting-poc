import type { TargetRecord } from '../../store/system1Store'

/**
 * "Final target" — the number every downstream calculation (exceptions,
 * cohort averages, mass adjustment previews) treats as this person's actual
 * current target. Now that M8 adds overrides, this prefers the override's
 * final value when one exists, falling back to the modelled value
 * otherwise — the one place that changed, so every caller (exceptions
 * detection, cohort averaging, the What-if sandbox's "currently stored"
 * panel) picks it up automatically.
 */
export function finalTargetFor(target: TargetRecord): number {
  return target.override?.finalValue ?? target.modelled
}
