/**
 * S2-M1 acceptance-signal evidence: "importing a snapshot with N approved
 * records produces exactly N records in System 2 — no silent drops or
 * duplicates." Run with: npm run verify:ingestion
 */
import { ingestSnapshot } from '../src/system2/engine/ingestSnapshot'
import type { Snapshot, SnapshotRecord } from '../src/system1/engine/buildSnapshot'

function record(id: string): SnapshotRecord {
  return {
    id,
    division: 'Design',
    team: 'Studio North',
    location: 'Boston',
    gradeCode: 2,
    roleTitle: 'Analyst',
    target: 50,
    approvedAt: '2026-01-01T00:00:00.000Z',
  }
}

function snapshot(ids: string[]): Snapshot {
  return {
    exportedAt: '2026-01-01T00:00:00.000Z',
    sourceSystem: 'System 1 — Individual Targeting',
    recordCount: ids.length,
    records: ids.map(record),
  }
}

let failures = 0
function check(label: string, condition: boolean) {
  console.log(`${label}: ${condition ? 'OK' : 'FAIL'}`)
  if (!condition) failures++
}

// Case 1: N in, N out, exact id set, no drops, no duplicates.
const ids17 = Array.from({ length: 17 }, (_, i) => `P${String(i + 1).padStart(3, '0')}`)
const snap17 = snapshot(ids17)
const out17 = ingestSnapshot(snap17)
check('17 records in -> 17 out', out17.length === 17)
check('no duplicate ids', new Set(out17.map((r) => r.id)).size === out17.length)
check('every input id present in output', ids17.every((id) => out17.some((r) => r.id === id)))
check('no id in output that was not in input', out17.every((r) => ids17.includes(r.id)))

// Case 2: empty snapshot -> empty output, no crash.
const outEmpty = ingestSnapshot(snapshot([]))
check('0 records in -> 0 out', outEmpty.length === 0)

// Case 3: determinism - ingesting the same snapshot twice gives identical values.
const runA = ingestSnapshot(snap17)
const runB = ingestSnapshot(snap17)
check(
  'same snapshot ingested twice -> identical output',
  JSON.stringify(runA) === JSON.stringify(runB),
)

// Case 4: per-id stability - a person's generated values are the same
// regardless of who else is in the snapshot or what order they appear in.
const p001Alone = ingestSnapshot(snapshot(['P001']))[0]
const p001WithOthersReversed = ingestSnapshot(snapshot([...ids17].reverse())).find((r) => r.id === 'P001')!
check(
  "P001's capacityUtilisation is order/composition independent",
  p001Alone.capacityUtilisation === p001WithOthersReversed.capacityUtilisation,
)
check(
  "P001's teamHistoricalTrend is order/composition independent",
  p001Alone.teamHistoricalTrend === p001WithOthersReversed.teamHistoricalTrend,
)

// Case 5: generated values stay within the locked ranges.
const inRange = out17.every(
  (r) =>
    r.capacityUtilisation >= 0.75 &&
    r.capacityUtilisation <= 1.05 &&
    r.teamHistoricalTrend >= 0.85 &&
    r.teamHistoricalTrend <= 1.05,
)
check('all generated values within locked ranges', inRange)

console.log()
if (failures > 0) {
  console.error(`${failures} check(s) failed.`)
  process.exit(1)
}
console.log('All ingestion checks passed.')
