/**
 * Boundary evidence for the shared money/percent formatter. The reported
 * defect was values crossing £1m still printing as thousands ("£5,820k"),
 * so the £999k->£1m and £999->£1k boundaries are the cases that matter.
 * Run with: npm run verify:format
 */
import {
  formatMoney,
  formatMoneyPrecise,
  formatPercent,
  formatFlatPercent,
  formatSignedPercent,
  formatPounds,
} from '../src/shared/format'

const cases: Array<[string, string, string]> = [
  // [what, actual, expected]
  ['0', formatMoney(0), '£0'],
  ['0.82k = £820', formatMoney(0.82), '£820'],
  ['0.999k = £999', formatMoney(0.999), '£999'],

  // £999 -> £1k boundary: rounds up across the band, must not print "£1000".
  ['0.9994k rounds to £999', formatMoney(0.9994), '£999'],
  ['0.9996k rolls to £1k', formatMoney(0.9996), '£1k'],
  ['1k exactly', formatMoney(1), '£1k'],

  ['582k', formatMoney(582), '£582k'],
  ['582.4k rounds down', formatMoney(582.4), '£582k'],
  ['582.6k rounds up', formatMoney(582.6), '£583k'],

  // £999k -> £1m boundary: the reported defect.
  ['999.4k stays thousands', formatMoney(999.4), '£999k'],
  ['999.6k rolls to millions', formatMoney(999.6), '£1.0m'],
  ['1000k = £1.0m', formatMoney(1000), '£1.0m'],

  ['5820k = £5.8m', formatMoney(5820), '£5.8m'],
  ['17820k = £17.8m', formatMoney(17820), '£17.8m'],
  ['16971.96k = £17.0m', formatMoney(16971.963901152463), '£17.0m'],

  ['negative millions', formatMoney(-5820), '−£5.8m'],
  ['negative thousands', formatMoney(-582), '−£582k'],
  ['negative pounds', formatMoney(-0.82), '−£820'],

  ['dayRate 675 as pounds', formatPounds(675), '£675'],
  ['dayRate 2500 as pounds', formatPounds(2500), '£3k'],

  ['percent 1dp', formatPercent(87.43), '87.4%'],
  ['percent pads to 1dp', formatPercent(87), '87.0%'],
  ['flat 85%', formatFlatPercent(0.85), '85%'],
  ['flat 65%', formatFlatPercent(0.65), '65%'],
  ['signed up', formatSignedPercent(12), '+12.0%'],
  ['signed down', formatSignedPercent(-8.5), '−8.5%'],

  // formatMoneyPrecise: explanatory before/after sentences only. Never rolls
  // up to millions, so a real delta at £m scale stays visible.
  // A £40k team movement, the kind the journey produces. One decimal at £m
  // scale renders both sides "£3.1m", so the sentence explaining the change
  // reads as a no-op. The precise form keeps the delta visible.
  ['banded form collapses a £40k move', `${formatMoney(3100)} to ${formatMoney(3140)}`, '£3.1m to £3.1m'],
  ['precise form keeps it', `${formatMoneyPrecise(3100)} to ${formatMoneyPrecise(3140)}`, '£3100k to £3140k'],
  ['precise at exactly 1000k', formatMoneyPrecise(1000), '£1000k'],
  ['precise below £1k falls to pounds', formatMoneyPrecise(0.82), '£820'],
  ['precise negative', formatMoneyPrecise(-3148), '−£3148k'],
]

let failed = 0
for (const [what, actual, expected] of cases) {
  const ok = actual === expected
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what.padEnd(28)} ${actual}${ok ? '' : `   expected ${expected}`}`)
}

console.log(`\n${cases.length - failed}/${cases.length} passed`)
if (failed > 0) process.exit(1)
