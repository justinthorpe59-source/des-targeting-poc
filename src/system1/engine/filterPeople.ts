import { TEAMS_BY_DIVISION, type Division, type Location, type Person } from '../data/types'

/**
 * The single filtering implementation for a division/team/location
 * combination. Population view (M4) uses it directly; Mass adjustment (M10)
 * operates on "a filtered population" per CLAUDE.md and is expected to
 * reuse this same function rather than re-implement filtering — same
 * one-source-of-truth principle as the targeting engine and exceptions
 * detector.
 */

export const ALL = 'All' as const

export interface PopulationFilter {
  division: Division | typeof ALL
  team: string | typeof ALL
  location: Location | typeof ALL
}

export const DEFAULT_FILTER: PopulationFilter = { division: ALL, team: ALL, location: ALL }

/** All team names across every division, for the team filter's option list. Not scoped to the currently selected division — an impossible combination (e.g. Engineering + Studio North) just correctly returns zero rows. */
export const ALL_TEAMS: string[] = Object.values(TEAMS_BY_DIVISION).flat()

export function filterPeople(people: Person[], filter: PopulationFilter): Person[] {
  return people.filter(
    (person) =>
      (filter.division === ALL || person.division === filter.division) &&
      (filter.team === ALL || person.team === filter.team) &&
      (filter.location === ALL || person.location === filter.location),
  )
}
