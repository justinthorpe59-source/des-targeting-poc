import type { Person } from '../data/types'
import type { TargetRecord } from '../../store/system1Store'

/**
 * Shared exceptions detector — the same function Overview's count and (at
 * M9) the full Exceptions queue screen both call, so there's one place the
 * locked thresholds are implemented, not two that could drift.
 *
 * Thresholds are locked in CLAUDE.md:
 *  - missing-data: any required field empty
 *  - extreme-value: capacity outside 0.5-1.0, or final target >25% from
 *    the team average
 *  - large-adjustment: manual change over +/-20% — NOT detected here yet.
 *    There's no override mechanism until M8, so a person's "final target"
 *    is always just their modelled target for now and this type can never
 *    fire. Left in the type union so M8/M9 extend this function rather
 *    than write a second one.
 */

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
  if (!person.roleTitle || person.roleFactor === null || person.roleFactor === undefined) return 'role is missing'
  if (!person.location) return 'location is missing'
  if (person.baseline === null || person.baseline === undefined) return 'baseline is missing'
  if (!target || target.modelled === null || target.modelled === undefined) return 'modelled target is missing'
  return null
}

/** "Final target" = the override value once M8 exists; modelled target until then. */
function finalTargetFor(target: TargetRecord): number {
  return target.modelled
}

function teamAverages(people: Person[], targets: Record<string, TargetRecord>): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>()
  for (const person of people) {
    const target = targets[person.id]
    if (!target) continue
    const key = `${person.division}::${person.team}`
    const entry = sums.get(key) ?? { total: 0, count: 0 }
    entry.total += finalTargetFor(target)
    entry.count += 1
    sums.set(key, entry)
  }
  const averages = new Map<string, number>()
  for (const [key, { total, count }] of sums) {
    averages.set(key, count > 0 ? total / count : 0)
  }
  return averages
}

export function detectExceptions({ people, targets }: DetectExceptionsInput): Map<string, ExceptionFlag[]> {
  const flagsByPerson = new Map<string, ExceptionFlag[]>()
  const averages = teamAverages(people, targets)

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
        if (deviation > 0.25) {
          flags.push({
            personId: person.id,
            type: 'extreme-value',
            detail: `final target £${finalTarget}k is ${Math.round(deviation * 100)}% from team average £${Math.round(teamAverage)}k`,
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
