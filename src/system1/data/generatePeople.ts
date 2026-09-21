import { FIRST_NAMES, LAST_NAMES } from './namePool'
import { mulberry32, randIndex, randRange, weightedChoice } from './prng'
import {
  BASELINE_BY_DIVISION,
  DIVISIONS,
  GRADES,
  GRADE_TABLE,
  LOCATIONS,
  SALES_TARGET_GRADES,
  TEAMS_BY_DIVISION,
  utilisationTargetFor,
  type Grade,
  type Person,
} from './types'

/**
 * Fixed, arbitrary seed. Do not change casually — changing it changes every
 * generated record and is a new population baseline, not a bugfix.
 */
export const DATA_SEED = 424242

export const POPULATION_SIZE = 60

/**
 * Diamond-shaped grade weights: fewest at Analyst and Partner, bulk
 * concentrated in the middle grades (Consultant through Principal
 * Consultant, 60% combined). Indexes line up with GRADES. Sums to 1.
 */
const GRADE_WEIGHTS = [0.06, 0.12, 0.2, 0.22, 0.18, 0.12, 0.07, 0.03] as const

/** £k bands, roughly scaled by seniority, for Managing Consultant+ sales targets. */
const SALES_TARGET_BAND: Partial<Record<Grade, [number, number]>> = {
  'Managing Consultant': [150, 250],
  'Associate Partner': [250, 400],
  Partner: [400, 650],
}

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

    const grade = weightedChoice(rng, GRADES, GRADE_WEIGHTS)
    const { roleFactor, dayRateBand } = GRADE_TABLE[grade]

    const capacity = round2(randRange(rng, 0.6, 1.0))
    const economicFactor = round2(randRange(rng, 0.9, 1.15))

    // +/-8% per-person jitter around the grade's day-rate band, nearest £25.
    const dayRate = Math.round((dayRateBand * randRange(rng, 0.92, 1.08)) / 25) * 25

    const utilisationTarget = utilisationTargetFor(grade)

    const salesBand = SALES_TARGET_BAND[grade]
    const salesTarget = SALES_TARGET_GRADES.includes(grade) && salesBand ? Math.round(randRange(rng, ...salesBand)) : null

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
      grade,
      roleFactor,
      capacity,
      economicFactor,
      baseline,
      dayRate,
      utilisationTarget,
      salesTarget,
    })
  }

  return people
}
