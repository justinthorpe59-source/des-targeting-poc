import type { TargetRecord } from '../../store/system1Store'

/**
 * "Final target" — the number every downstream calculation (exceptions,
 * cohort averages, mass adjustment previews) should treat as this person's
 * actual current target. Today that's always the modelled value, since no
 * override mechanism exists yet. When M8 adds overrides, this is the one
 * place that changes to prefer an override value when present — every
 * caller picks it up automatically rather than needing its own update.
 */
export function finalTargetFor(target: TargetRecord): number {
  return target.modelled
}
