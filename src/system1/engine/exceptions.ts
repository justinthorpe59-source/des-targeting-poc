import type { Person } from '../data/types'
import type { TargetRecord } from '../../store/system1Store'
import { finalTargetFor } from './finalTarget'
import { buildTeamAverageMap } from './cohortAverages'

/**
 * Shared exceptions detector — the same function Overview's count and (at
 * M9) the full Exceptions queue screen both call, so there's one place the
 * locked thresholds are implemented, not two that could drift.
 *
 * Thresholds are locked in CLAUDE.md:
 *  - missing-data: any required field empty
 *  - extreme-value: capacity outside 0.5-1.0, or final target >25% from
 *    the team average
 *  - large-adjustment: manual change over +/-20% — implemented at M8, since
 *    it needs an actual override to exist. Never blocks; flagged for the
 *    manager's own sense-check only, same as every other exception here.
 */

/** Locked in CLAUDE.md: final target >25% from the team average is an extreme-value exception. Also reused by the override cross-check's level-cohort norm check — same "significant outlier from a peer average" concept, one number. */
export const EXTREME_VALUE_DEVIATION_THRESHOLD = 0.25

/** Locked in CLAUDE.md: a manual change over ±20% is a large-adjustment exception. Also reused by Manager Override's own inline flag and the override cross-check's "drastic percentage change" sign-off trigger — one number, not three copies. */
export const LARGE_ADJUSTMENT_THRESHOLD = 0.2

export type ExceptionType = 'missing-data' | 'extreme-value' | 'large-adjustment'

export interface ExceptionFlag {
  personId: string
  type: ExceptionType
  detail: string
}

interface DetectExceptionsInput {
  people: Person[]
  targets: Record<string, TargetRecord>
}

function hasMissingData(person: Person, target: TargetRecord | undefined): string | null {
  if (person.capacity === null || person.capacity === undefined) return 'capacity is missing'
  if (person.economicFactor === null || person.economicFactor === undefined) return 'economic factor is missing'
  if (!person.grade || person.roleFactor === null || person.roleFactor === undefined) return 'role is missing'
  if (!person.location) return 'location is missing'
  if (person.baseline === null || person.baseline === undefined) return 'baseline is missing'
  if (!target || target.modelled === null || target.modelled === undefined) return 'modelled target is missing'
  return null
}

export function detectExceptions({ people, targets }: DetectExceptionsInput): Map<string, ExceptionFlag[]> {
  const flagsByPerson = new Map<string, ExceptionFlag[]>()
  const averages = buildTeamAverageMap(people, targets)

  for (const person of people) {
    const target = targets[person.id]
    const flags: ExceptionFlag[] = []

    const missingReason = hasMissingData(person, target)
    if (missingReason) {
      flags.push({ personId: person.id, type: 'missing-data', detail: missingReason })
    }

    if (target) {
      if (person.capacity < 0.5 || person.capacity > 1.0) {
        flags.push({
          personId: person.id,
          type: 'extreme-value',
          detail: `capacity ${person.capacity} is outside 0.5-1.0`,
        })
      }

      const teamAverage = averages.get(`${person.division}::${person.team}`)
      if (teamAverage && teamAverage > 0) {
        const finalTarget = finalTargetFor(target)
        const deviation = Math.abs(finalTarget - teamAverage) / teamAverage
        if (deviation > EXTREME_VALUE_DEVIATION_THRESHOLD) {
          flags.push({
            personId: person.id,
            type: 'extreme-value',
            detail: `final target £${finalTarget}k is ${Math.round(deviation * 100)}% from team average £${Math.round(teamAverage)}k`,
          })
        }
      }

      if (target.override) {
        const adjustmentPct = (target.override.finalValue - target.modelled) / target.modelled
        if (Math.abs(adjustmentPct) > LARGE_ADJUSTMENT_THRESHOLD) {
          flags.push({
            personId: person.id,
            type: 'large-adjustment',
            detail: `override moved the target ${Math.round(adjustmentPct * 100)}% from modelled £${target.modelled}k to £${target.override.finalValue}k`,
          })
        }
      }
    }

    if (flags.length > 0) {
      flagsByPerson.set(person.id, flags)
    }
  }

  return flagsByPerson
}
