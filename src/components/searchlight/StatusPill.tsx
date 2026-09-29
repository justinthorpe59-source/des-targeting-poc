import type { TargetStatus } from '../../store/system1Store'
import type { RiskStatus } from '../../system2/engine/riskStatus'

/**
 * The shared status pill from searchlight-visual-spec.md's global system —
 * one component, two uses. Shape is a true pill (fully rounded), solid
 * colour fill (not a wash, not an outline), centred label.
 *
 * Use 1 — target workflow state (System 1).
 * Use 2 — risk status (System 2).
 *
 * Colours come from the semantic role tokens in index.css, never raw
 * palette values, so the mapping lives in exactly one place.
 *
 * Known contrast gap, flagged rather than papered over: PA's palette has no
 * red darker than Rose-04 / Ingenuity Red. Against either, both white and
 * Dark Blue land at roughly 4.3-4.4:1 — just under WCAG AA's 4.5:1 for text
 * this size. 'Off track' and 'Infeasible' therefore ship marginally below
 * AA. Closing it properly needs a darker red token from PA; approximating
 * one here would be inventing a hex the design system doesn't have, which
 * the spec forbids. Every other state passes.
 */

type PillTone = { fill: string; text: string }

const STATE_TONE: Record<TargetStatus, PillTone> = {
  Modelled: { fill: 'var(--color-pa-state-modelled)', text: 'var(--color-pa-dark-blue)' },
  Adjusted: { fill: 'var(--color-pa-state-adjusted)', text: 'var(--color-pa-dark-blue)' },
  'Pending Sign-off': { fill: 'var(--color-pa-state-pending-signoff)', text: 'var(--color-pa-dark-blue)' },
  Proposed: { fill: 'var(--color-pa-state-proposed)', text: 'var(--color-pa-white)' },
  Approved: { fill: 'var(--color-pa-state-approved)', text: 'var(--color-pa-dark-blue)' },
}

const RISK_TONE: Record<RiskStatus, PillTone> = {
  'On track': { fill: 'var(--color-pa-risk-on-track)', text: 'var(--color-pa-white)' },
  'At risk': { fill: 'var(--color-pa-risk-at-risk)', text: 'var(--color-pa-dark-blue)' },
  // Dark Blue, not white, on the two reds — see the contrast note above.
  'Off track': { fill: 'var(--color-pa-risk-off-track)', text: 'var(--color-pa-dark-blue)' },
  Infeasible: { fill: 'var(--color-pa-risk-infeasible)', text: 'var(--color-pa-dark-blue)' },
}

export function StatusPill({
  state,
  risk,
  size = 'sm',
  testId,
}: {
  state?: TargetStatus
  risk?: RiskStatus
  size?: 'sm' | 'md'
  testId?: string
}) {
  const label = state ?? risk
  if (!label) return null
  const tone = state ? STATE_TONE[state] : RISK_TONE[risk!]

  return (
    <span
      data-testid={testId}
      data-status={label}
      className={`inline-flex items-center justify-center rounded-full text-center font-pa-body font-semibold leading-none ${
        size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
      }`}
      style={{ background: tone.fill, color: tone.text }}
    >
      {label}
    </span>
  )
}
