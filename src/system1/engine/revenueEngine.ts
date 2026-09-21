import type { Person } from '../data/types'

/**
 * The unified revenue model. Separate from targetingEngine.ts's baseline
 * formula (still locked, still drives the Modelled -> Adjusted -> Proposed
 * -> Approved workflow, ranges, and overrides) — this is the real-economics
 * figure: everyone's utilisation converts to billable revenue, and Managing
 * Consultant+ additionally carry sales-target revenue on top. Pure function
 * of Person fields only, independent of override/status — recalculating the
 * same record twice always gives the same answer.
 *
 * Illustrative UK-consultancy assumption, not locked by the spec: ~220
 * working days/year (annual weekdays less typical annual leave, bank
 * holidays, and non-billable time).
 */
export const WORKING_DAYS_PER_YEAR = 220

export interface RevenueContribution {
  /** £k. day rate x utilisation target x working days. Applies to everyone. */
  billableRevenue: number
  /** £k. The sales/economic target value, additive, Managing Consultant+ only. */
  salesRevenue: number
  /** £k. billableRevenue + salesRevenue — what rolls up into System 2's organisational goal. */
  combinedRevenue: number
}

function roundToNearestK(value: number): number {
  return Math.round(value)
}

export function calculateRevenue(person: Person): RevenueContribution {
  const billableRevenue = (person.dayRate * person.utilisationTarget * WORKING_DAYS_PER_YEAR) / 1000
  const salesRevenue = person.salesTarget ?? 0
  return {
    billableRevenue: roundToNearestK(billableRevenue),
    salesRevenue,
    combinedRevenue: roundToNearestK(billableRevenue + salesRevenue),
  }
}

/** Convenience for callers that only need the headline £k figure. */
export function combinedRevenueFor(person: Person): number {
  return calculateRevenue(person).combinedRevenue
}
