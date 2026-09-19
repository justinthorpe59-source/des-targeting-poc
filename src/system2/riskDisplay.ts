import type { RiskStatus } from './engine/riskStatus'

/**
 * Shared display helpers for anything rendering a RiskStatus/£k figure.
 * Extracted at S2-M4 out of ScreenB; the Searchlight design pass (System 2
 * batch) moved statusBadgeClass onto the PA severity palette so the four
 * risk states read as four distinct colours everywhere they appear.
 */

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// Severity-differentiated pill classes — On track (Aqua) / At risk (Apricot)
// / Off track (Rose-04, a warning red) / Infeasible (Ingenuity Red, reserved
// for the most severe state). Ingenuity Red's light wash (#fdecee) isn't a
// PA token, so it's inline; white-on-solid-red would fall short of WCAG AA
// at pill text size.
export function statusBadgeClass(status: RiskStatus): string {
  switch (status) {
    case 'On track':
      return 'bg-pa-aqua-01 text-pa-aqua-05'
    case 'At risk':
      return 'bg-pa-apricot-02 text-pa-grey-04'
    case 'Off track':
      return 'bg-pa-rose-01 text-pa-rose-04'
    case 'Infeasible':
      return 'bg-[#fdecee] text-pa-ingenuity-red'
  }
}

// Solid fill (CSS var) for a status, for chart bars where the pill wash would
// be too pale to read as a data mark.
export function statusFill(status: RiskStatus): string {
  switch (status) {
    case 'On track':
      return 'var(--color-pa-aqua-04)'
    case 'At risk':
      return 'var(--color-pa-apricot-03)'
    case 'Off track':
      return 'var(--color-pa-rose-04)'
    case 'Infeasible':
      return 'var(--color-pa-ingenuity-red)'
  }
}
