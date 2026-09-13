import type { Division, Person } from '../data/types'
import type { TargetRecord } from '../../store/system1Store'
import { finalTargetFor } from './finalTarget'

/**
 * Shared cohort-averaging logic. M3's exceptions detector and M6's Cohort
 * comparison screen both need "this team's average final target" — one
 * implementation here, not two.
 */

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Average final target per team, keyed by "division::team" (team names repeat across divisions). */
export function buildTeamAverageMap(people: Person[], targets: Record<string, TargetRecord>): Map<string, number> {
  const byTeam = new Map<string, number[]>()
  for (const person of people) {
    const target = targets[person.id]
    if (!target) continue
    const key = `${person.division}::${person.team}`
    const values = byTeam.get(key) ?? []
    values.push(finalTargetFor(target))
    byTeam.set(key, values)
  }
  const result = new Map<string, number>()
  for (const [key, values] of byTeam) result.set(key, average(values))
  return result
}

/** Average final target per division. */
export function buildDivisionAverageMap(
  people: Person[],
  targets: Record<string, TargetRecord>,
): Map<Division, number> {
  const byDivision = new Map<Division, number[]>()
  for (const person of people) {
    const target = targets[person.id]
    if (!target) continue
    const values = byDivision.get(person.division) ?? []
    values.push(finalTargetFor(target))
    byDivision.set(person.division, values)
  }
  const result = new Map<Division, number>()
  for (const [division, values] of byDivision) result.set(division, average(values))
  return result
}

export interface CohortAverages {
  teamAverage: number
  divisionAverage: number
}

/** Convenience for a single person — Cohort comparison's use case. Team/division averages both include the person themselves, same as M3's exceptions check. */
export function computeCohortAverages(
  person: Person,
  people: Person[],
  targets: Record<string, TargetRecord>,
): CohortAverages {
  const teamMap = buildTeamAverageMap(people, targets)
  const divisionMap = buildDivisionAverageMap(people, targets)
  return {
    teamAverage: teamMap.get(`${person.division}::${person.team}`) ?? 0,
    divisionAverage: divisionMap.get(person.division) ?? 0,
  }
}
