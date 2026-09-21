import { DIVISIONS, type Division, type Person } from '../data/types'
import { combinedRevenueFor } from './revenueEngine'

/**
 * Population view's grouping levels. 'none' is handled by the screen itself
 * (renders the original flat table) rather than here — there's nothing to
 * group.
 */
export const GROUP_LEVELS = ['team', 'division', 'des-wide', 'none'] as const
export type GroupLevel = (typeof GROUP_LEVELS)[number]

export interface PopulationGroup {
  key: string
  label: string
  people: Person[]
  /** £k. Sum of combinedRevenueFor() across the group — the same figure Overview/Snapshot Export roll up. */
  combinedRevenue: number
}

function toGroup(key: string, label: string, people: Person[]): PopulationGroup {
  return { key, label, people, combinedRevenue: people.reduce((sum, p) => sum + combinedRevenueFor(p), 0) }
}

/**
 * Groups an already-filtered people list. Filtering happens upstream
 * (filterPeople()) — this only ever groups what it's given, so a filter
 * narrows which groups/people appear rather than this function re-deriving
 * anything.
 */
export function groupPeople(people: Person[], level: Exclude<GroupLevel, 'none'>): PopulationGroup[] {
  if (level === 'des-wide') {
    return people.length > 0 ? [toGroup('des-wide', 'DES-wide', people)] : []
  }

  if (level === 'division') {
    const byDivision = new Map<Division, Person[]>()
    for (const person of people) {
      const arr = byDivision.get(person.division) ?? []
      arr.push(person)
      byDivision.set(person.division, arr)
    }
    return DIVISIONS.filter((d) => byDivision.has(d)).map((d) => toGroup(d, d, byDivision.get(d)!))
  }

  // team, keyed "division::team" since team names repeat across divisions
  // (same convention as cohortAverages.ts and System 2's aggregation).
  const byTeam = new Map<string, Person[]>()
  for (const person of people) {
    const key = `${person.division}::${person.team}`
    const arr = byTeam.get(key) ?? []
    arr.push(person)
    byTeam.set(key, arr)
  }
  const divisionOrder = new Map(DIVISIONS.map((d, i) => [d, i]))
  return [...byTeam.entries()]
    .sort(([, a], [, b]) => {
      const divDiff = divisionOrder.get(a[0].division)! - divisionOrder.get(b[0].division)!
      return divDiff !== 0 ? divDiff : a[0].team.localeCompare(b[0].team)
    })
    .map(([key, groupPeople]) => toGroup(key, `${groupPeople[0].division} / ${groupPeople[0].team}`, groupPeople))
}
