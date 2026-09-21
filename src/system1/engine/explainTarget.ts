import type { Person } from '../data/types'
import type { TargetRecord } from '../../store/system1Store'

/**
 * The single explanation-text implementation. Individual Detail (M5) and
 * Employee View (M12) both call this — M12's own acceptance signal is
 * "shows the same explanation... as Individual Detail", so this can't be
 * duplicated as inline JSX in two screens.
 *
 * Every clause below cites the person's actual stored values — nothing here
 * is placeholder text, so recalculating with different inputs changes the
 * sentence, not just the numbers around it.
 */
export function explainTarget(person: Person, target: TargetRecord): string {
  return (
    `${person.division}'s baseline for this role is £${person.baseline}k. ` +
    `Adjusted for your capacity (${person.capacity} of full-time), your role factor ` +
    `(${person.roleFactor} for ${person.grade}), and the current economic ` +
    `factor (${person.economicFactor}), the modelled target is £${target.modelled}k — expressed as a range of ` +
    `£${target.rangeLow}k to £${target.rangeHigh}k (±15%) rather than a single fixed number, since this is a ` +
    `starting point for a conversation, not a formula-only decision.`
  )
}
