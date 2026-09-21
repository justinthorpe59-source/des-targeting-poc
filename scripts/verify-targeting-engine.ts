/**
 * M2 acceptance-signal evidence: recalculating the same record twice must
 * give the same modelled target and range. Run with: npm run verify:engine
 */
import { calculateModelledTarget } from '../src/system1/engine/targetingEngine'
import { SEED_PEOPLE } from '../src/system1/data/people'

const sampleIds = ['P001', 'P025', 'P050']
let mismatches = 0

for (const id of sampleIds) {
  const person = SEED_PEOPLE.find((p) => p.id === id)
  if (!person) {
    console.error(`No such record: ${id}`)
    process.exit(1)
  }

  const inputs = {
    baseline: person.baseline,
    capacity: person.capacity,
    roleFactor: person.roleFactor,
    economicFactor: person.economicFactor,
  }

  const run1 = calculateModelledTarget(inputs)
  const run2 = calculateModelledTarget(inputs)

  const identical =
    run1.modelled === run2.modelled && run1.rangeLow === run2.rangeLow && run1.rangeHigh === run2.rangeHigh

  console.log(`${person.id} — ${person.name} (${person.division}, ${person.grade})`)
  console.log(
    `  baseline=${inputs.baseline} x capacity=${inputs.capacity} x roleFactor=${inputs.roleFactor} x economicFactor=${inputs.economicFactor}`,
  )
  console.log(`  run 1: modelled=£${run1.modelled}k  range=£${run1.rangeLow}k-£${run1.rangeHigh}k`)
  console.log(`  run 2: modelled=£${run2.modelled}k  range=£${run2.rangeLow}k-£${run2.rangeHigh}k`)
  console.log(`  identical: ${identical ? 'YES' : 'NO — MISMATCH'}`)
  console.log()

  if (!identical) mismatches++
}

if (mismatches > 0) {
  console.error(`${mismatches} record(s) produced different results on re-run.`)
  process.exit(1)
}

console.log(`All ${sampleIds.length} sample records: identical across two independent calls.`)
