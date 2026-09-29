import type { Person } from '../data/types'
import { calculateRevenue } from '../engine/revenueEngine'
import { formatMoney, formatFlatPercent } from '../../shared/format'

/**
 * How an individual's target is displayed, everywhere it appears.
 *
 * Decided 27 Sept 2026. For everyone below Managing Consultant the only
 * target they carry is **utilisation**, expressed as a percentage — so that
 * is the lead figure, first and most prominent. The monetary equivalent
 * (day rate x utilisation x working days) stays visible but is a supporting
 * figure, never the lead. Managing Consultant and above additionally carry
 * a sales target, which gets its own labelled figure rather than being
 * folded into the utilisation-derived one.
 *
 * That last point is a real correction, not just an ordering change: these
 * screens previously printed `combinedRevenueFor(person)`, which is
 * billable + sales added together. For a Partner that single number silently
 * merged two targets of different kinds. The secondary figure here is
 * billable revenue alone.
 *
 * The utilisation percentage is a defined flat rate (65% for Analyst, 85%
 * for everyone else), so it is rendered whole — a decimal place would imply
 * a precision it does not have.
 *
 * NOTE: none of this is the *modelled target* (baseline x capacity x role x
 * economic). That is a third quantity, it is what the override and sign-off
 * workflow acts on, and it is unchanged by this component — see the screens
 * that show a before/after, where this renders as context beside the figure
 * actually being changed.
 */

/** Full treatment — the lead position on Individual Detail. */
export function IndividualTargetLead({ person }: { person: Person }) {
  const { billableRevenue, salesRevenue } = calculateRevenue(person)
  const hasSalesTarget = person.salesTarget !== null

  return (
    <>
      <div>
        <div
          data-testid="detail-utilisation"
          className="font-pa-mono text-4xl font-bold leading-none text-pa-grey-04"
        >
          {formatFlatPercent(person.utilisationTarget)}
        </div>
        <div className="mt-1.5 font-pa-body text-sm text-pa-grey-03">Utilisation target</div>
        <div data-testid="detail-billable" className="mt-1 font-pa-body text-sm text-pa-grey-03">
          <span className="font-pa-mono text-pa-grey-04">{formatMoney(billableRevenue)}</span> billable
        </div>
      </div>

      {hasSalesTarget && (
        <div>
          <div
            data-testid="detail-sales-target"
            className="font-pa-mono text-4xl font-bold leading-none text-pa-grey-04"
          >
            {formatMoney(salesRevenue)}
          </div>
          <div className="mt-1.5 font-pa-body text-sm text-pa-grey-03">Sales target</div>
          <div className="mt-1 font-pa-body text-sm text-pa-grey-03">{person.grade} and above only</div>
        </div>
      )}
    </>
  )
}

/**
 * One-line treatment for rows and cards — roster cards, queue rows, mass
 * adjustment previews. Same order: utilisation first, billable second,
 * sales target as its own labelled item when the person has one.
 */
export function IndividualTargetInline({ person, testId }: { person: Person; testId?: string }) {
  const { billableRevenue, salesRevenue } = calculateRevenue(person)

  return (
    <span data-testid={testId} className="font-pa-body text-xs text-pa-grey-03">
      <span data-testid="target-utilisation" className="font-pa-mono font-bold text-pa-grey-04">
        {formatFlatPercent(person.utilisationTarget)}
      </span>{' '}
      utilisation
      <span className="px-1.5 text-pa-grey-02">·</span>
      <span data-testid="target-billable" className="font-pa-mono text-pa-grey-04">
        {formatMoney(billableRevenue)}
      </span>{' '}
      billable
      {person.salesTarget !== null && (
        <>
          <span className="px-1.5 text-pa-grey-02">·</span>
          <span data-testid="target-sales" className="font-pa-mono text-pa-grey-04">
            {formatMoney(salesRevenue)}
          </span>{' '}
          sales target
        </>
      )}
    </span>
  )
}
