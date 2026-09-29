/**
 * Generates System 2's pre-loaded demo snapshot.
 *
 * System 2 used to open on "No snapshot imported yet", so nothing in it was
 * reviewable until someone clicked through System 1's export and then
 * Executive Summary's import. This produces the committed seed that the
 * store starts from instead.
 *
 * It is not fabricated separately from System 1's data: it runs the REAL
 * buildSnapshot() over the real seed population with every record Approved,
 * so the file is byte-identical to what a genuine export of the seed
 * population produces. The import/export path itself is untouched — this
 * only changes the starting state.
 *
 * `exportedAt` is pinned rather than `new Date()`, so regenerating twice
 * produces identical output (the same reproducibility rule M1 holds the
 * dataset to).
 *
 * Run with: npm run generate:snapshot-seed
 */
import { writeFileSync } from 'node:fs'
import { SEED_PEOPLE } from '../src/system1/data/people'
import { buildSnapshot } from '../src/system1/engine/buildSnapshot'
import { calculateModelledTarget } from '../src/system1/engine/targetingEngine'
import type { TargetRecord } from '../src/store/system1Store'

/** Pinned so the generator is reproducible. */
const SEEDED_AT = '2026-09-27T00:00:00.000Z'
const OUT = 'src/system2/data/snapshot.seed.json'

const targets: Record<string, TargetRecord> = {}
for (const person of SEED_PEOPLE) {
  const modelled = calculateModelledTarget(person)
  targets[person.id] = {
    personId: person.id,
    status: 'Approved',
    modelled: modelled.modelled,
    rangeLow: modelled.rangeLow,
    rangeHigh: modelled.rangeHigh,
    notes: '',
    approvedAt: SEEDED_AT,
  }
}

const snapshot = { ...buildSnapshot(SEED_PEOPLE, targets), exportedAt: SEEDED_AT }

writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n')
console.log(`Wrote ${OUT} — ${snapshot.recordCount} approved records, exportedAt ${snapshot.exportedAt}`)
