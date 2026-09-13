import { FIRST_NAMES, LAST_NAMES } from './namePool'
import { mulberry32, randIndex, randRange, weightedChoice } from './prng'
import {
  BASELINE_BY_DIVISION,
  DIVISIONS,
  GRADE_CODES,
  GRADE_TABLE,
  LOCATIONS,
  TEAMS_BY_DIVISION,
  type Person,
} from './types'

/**
 * Fixed, arbitrary seed. Do not change casually — changing it changes every
 * generated record and is a new population baseline, not a bugfix.
 */
export const DATA_SEED = 424242

export const POPULATION_SIZE = 50

/**
 * Org-pyramid grade weights: more Analysts/Engineers, fewer Leads/Principals.
 * Indexes line up with GRADE_CODES ([2,3,4,5,6]). Sums to 1.
 */
const GRADE_WEIGHTS = [0.2, 0.35, 0.25, 0.15, 0.05] as const

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Pure, deterministic: same seed in -> byte-identical Person[] out, every
 * time, on every machine. No Math.random(), no Date.now(), no I/O.
 */
export function generatePeople(seed: number = DATA_SEED): Person[] {
  const rng = mulberry32(seed)
  const divisionTeamCounters: Record<string, number> = {}
  const people: Person[] = []

  for (let i = 0; i < POPULATION_SIZE; i++) {
    const id = `P${String(i + 1).padStart(3, '0')}`

    // Round-robin division/location assignment (periods 3 and 4 are coprime,
    // so every division x location combination gets covered) guarantees no
    // division, team, or location ends up empty. Grade, capacity, economic
    // factor, and name are true seeded-random draws.
    const division = DIVISIONS[i % DIVISIONS.length]
    const location = LOCATIONS[i % LOCATIONS.length]

    const teamCounterKey = division
    const teamIndex = (divisionTeamCounters[teamCounterKey] ?? 0) % 2
    divisionTeamCounters[teamCounterKey] = (divisionTeamCounters[teamCounterKey] ?? 0) + 1
    const team = TEAMS_BY_DIVISION[division][teamIndex]

    const gradeCode = weightedChoice(rng, GRADE_CODES, GRADE_WEIGHTS)
    const { roleTitle, roleFactor } = GRADE_TABLE[gradeCode]

    const capacity = round2(randRange(rng, 0.6, 1.0))
    const economicFactor = round2(randRange(rng, 0.9, 1.15))

    const firstName = FIRST_NAMES[randIndex(rng, FIRST_NAMES.length)]
    const lastName = LAST_NAMES[randIndex(rng, LAST_NAMES.length)]
    const name = `${firstName} ${lastName}`

    const baseline = BASELINE_BY_DIVISION[division]

    people.push({
      id,
      name,
      division,
      team,
      location,
      gradeCode,
      roleTitle,
      roleFactor,
      capacity,
      economicFactor,
      baseline,
    })
  }

  return people
}
