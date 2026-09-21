/**
 * Core person record for System 1. These are the *input* attributes the
 * targeting engine (M2) reads from — this file does not compute a modelled
 * target itself; that's the engine's job, kept separate so recalculation is
 * always a pure function of these fields.
 *
 * Field coverage matches the Exceptions queue's "missing data" check in
 * CLAUDE.md exactly: capacity, economic factor, role, location, baseline.
 */

export const DIVISIONS = ['Design', 'Engineering', 'Science'] as const
export type Division = (typeof DIVISIONS)[number]

export const LOCATIONS = ['Boston', 'Ireland', 'London', 'GITC'] as const
export type Location = (typeof LOCATIONS)[number]

/** Locked: Divisions & baseline (£k). */
export const BASELINE_BY_DIVISION: Record<Division, number> = {
  Design: 92,
  Engineering: 100,
  Science: 96,
}

/** Locked: Teams, 2 per division, names taken verbatim from CLAUDE.md's examples. */
export const TEAMS_BY_DIVISION: Record<Division, [string, string]> = {
  Design: ['Studio North', 'Studio South'],
  Engineering: ['Platform', 'Delivery'],
  Science: ['Research', 'Applied'],
}

/**
 * Locked: the real consultancy grade ladder. Applies identically regardless
 * of discipline (design vs engineering) — there is no separate ladder per
 * division.
 */
export const GRADES = [
  'Analyst',
  'Consultant Analyst',
  'Consultant',
  'Senior Consultant',
  'Principal Consultant',
  'Managing Consultant',
  'Associate Partner',
  'Partner',
] as const
export type Grade = (typeof GRADES)[number]

/** Only Managing Consultant and above carry a sales/economic target. */
export const SALES_TARGET_GRADES: readonly Grade[] = ['Managing Consultant', 'Associate Partner', 'Partner']

/** Locked: 65% for Analyst, 85% for every other grade — not tiered further. */
export function utilisationTargetFor(grade: Grade): number {
  return grade === 'Analyst' ? 0.65 : 0.85
}

/**
 * Grade -> role factor (feeds the still-locked baseline targeting formula)
 * and an illustrative UK-consultancy day-rate band (£/day, before the
 * generator's per-person jitter). Day rates are directional, not precise —
 * they just need to increase materially with seniority.
 */
export const GRADE_TABLE: Record<Grade, { roleFactor: number; dayRateBand: number }> = {
  Analyst: { roleFactor: 0.85, dayRateBand: 550 },
  'Consultant Analyst': { roleFactor: 0.95, dayRateBand: 650 },
  Consultant: { roleFactor: 1.05, dayRateBand: 800 },
  'Senior Consultant': { roleFactor: 1.2, dayRateBand: 1000 },
  'Principal Consultant': { roleFactor: 1.35, dayRateBand: 1250 },
  'Managing Consultant': { roleFactor: 1.55, dayRateBand: 1550 },
  'Associate Partner': { roleFactor: 1.75, dayRateBand: 1950 },
  Partner: { roleFactor: 2.0, dayRateBand: 2500 },
}

export interface Person {
  id: string
  name: string
  division: Division
  /** Only meaningful combined with division — team names repeat across divisions. */
  team: string
  location: Location
  grade: Grade
  roleFactor: number
  /** Random 0.6-1.0 per record. Feeds the targeting formula as the capacity factor. */
  capacity: number
  /** Random 0.9-1.15 per record. */
  economicFactor: number
  /** £k, looked up from division. Cohort baseline in the modelled-target formula. */
  baseline: number
  /** £/day, varies by grade with per-person jitter. Feeds billable revenue. */
  dayRate: number
  /** 0.65 for Analyst, 0.85 for everyone else — see utilisationTargetFor(). */
  utilisationTarget: number
  /** £k. Populated only for Managing Consultant and above; null (not 0) for everyone else — null means "not a target this person has", not "a target of zero". */
  salesTarget: number | null
}
