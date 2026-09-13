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

export const GRADE_CODES = [2, 3, 4, 5, 6] as const
export type GradeCode = (typeof GRADE_CODES)[number]

/** Locked: Grade -> role title + role factor. */
export const GRADE_TABLE: Record<GradeCode, { roleTitle: string; roleFactor: number }> = {
  2: { roleTitle: 'Analyst', roleFactor: 0.85 },
  3: { roleTitle: 'Engineer', roleFactor: 1.0 },
  4: { roleTitle: 'Senior Engineer', roleFactor: 1.15 },
  5: { roleTitle: 'Lead', roleFactor: 1.3 },
  6: { roleTitle: 'Principal', roleFactor: 1.5 },
}

export interface Person {
  id: string
  name: string
  division: Division
  /** Only meaningful combined with division — team names repeat across divisions. */
  team: string
  location: Location
  gradeCode: GradeCode
  roleTitle: string
  roleFactor: number
  /** Random 0.6-1.0 per record. Feeds the targeting formula as the capacity factor. */
  capacity: number
  /** Random 0.9-1.15 per record. */
  economicFactor: number
  /** £k, looked up from division. Cohort baseline in the modelled-target formula. */
  baseline: number
}
