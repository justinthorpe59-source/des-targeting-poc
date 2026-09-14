import type { RiskStatus } from './engine/riskStatus'

/**
 * Shared display helpers for anything rendering a RiskStatus/£k figure.
 * Extracted at S2-M4 out of ScreenB (which had them file-local since
 * S2-M3) so Executive Summary doesn't duplicate them.
 */

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function statusBadgeClass(status: RiskStatus): string {
  switch (status) {
    case 'On track':
      return 'bg-emerald-100 text-emerald-800'
    case 'At risk':
      return 'bg-amber-100 text-amber-800'
    case 'Off track':
      return 'bg-orange-100 text-orange-800'
    case 'Infeasible':
      return 'bg-red-100 text-red-800'
  }
}
