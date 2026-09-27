/**
 * The single place money and percentages are formatted, for both systems.
 *
 * Before this existed every screen formatted inline, and the two habits
 * disagreed at scale boundaries: `£${n.toLocaleString()}k` printed
 * "£5,820k" and "£17,820k" for figures that are £5.8m and £17.8m, while
 * Executive Summary's hero had its own `(n / 1000).toFixed(2)}m`. Same
 * number, three different strings depending on the screen.
 *
 * **Every monetary value in this codebase is in £k** — Person.baseline,
 * Person.salesTarget, TargetRecord.modelled, OrgRecord.target, every
 * rollup and goal. formatMoney() takes that unit. The one exception in the
 * data model is Person.dayRate, which is in whole pounds; pass that through
 * formatPounds() instead.
 */

/**
 * £k -> a banded string.
 *
 *   below £1,000      full number      £820
 *   £1k - £999,999    thousands, 0dp   £582k
 *   £1,000,000 +      millions, 1dp    £17.8m
 *
 * Banding is decided on the ROUNDED figure, not the raw one, so a value
 * that rounds up across a boundary moves band with it: 999.6k is £1.0m,
 * never "£1000k", and £999.7 is £1k, never "£1000".
 */
export function formatMoney(valueInThousands: number): string {
  const sign = valueInThousands < 0 ? '−' : ''
  const k = Math.abs(valueInThousands)

  // Millions, once the thousands figure would itself round to 1000+.
  if (Math.round(k) >= 1000) return `${sign}£${(k / 1000).toFixed(1)}m`

  // Thousands, once the pounds figure would round to £1,000+.
  const pounds = k * 1000
  if (Math.round(pounds) >= 1000) return `${sign}£${Math.round(k)}k`

  return `${sign}£${Math.round(pounds)}`
}

/** Whole pounds -> the same banding. For Person.dayRate and nothing else. */
export function formatPounds(valueInPounds: number): string {
  return formatMoney(valueInPounds / 1000)
}

/**
 * A computed ratio as a percentage, always one decimal place — coverage,
 * forecast, deviation, adjustment. Takes the percentage, not the ratio:
 * pass `ratio * 100`.
 */
export function formatPercent(percent: number): string {
  return `${percent.toFixed(1)}%`
}

/** A ratio (0-1) as a one-decimal percentage. */
export function formatRatioPercent(ratio: number): string {
  return formatPercent(ratio * 100)
}

/**
 * A policy figure that is a defined flat rate, not a measurement — the
 * 65%/85% utilisation targets. These are whole by definition, so a decimal
 * place would imply a precision the number does not have.
 */
export function formatFlatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

/** A signed delta as a one-decimal percentage, e.g. "+12.0%" / "−8.5%". */
export function formatSignedPercent(percent: number): string {
  return `${percent >= 0 ? '+' : '−'}${Math.abs(percent).toFixed(1)}%`
}
