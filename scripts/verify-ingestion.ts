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


/*
 * Merge-on-import (29 Sept 2026). importSnapshot() used to replace the whole
 * record set; it now merges by person id, because System 2 carries a seeded
 * 60-record baseline and a small approval batch was erasing the other 56.
 *
 * S2-M1's signal is unchanged in substance — a snapshot of N records still
 * produces exactly N updated-or-added records, no drops, no duplicates — but
 * it is now a statement about the merge rather than about a swap, so it needs
 * its own check.
 */
{
  /* Node has no localStorage, so zustand's persist middleware logs on every
     write. The store's logic is what is under test here, not its persistence,
     so the warning is silenced rather than left to bury the results. */
  const warn = console.warn
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('persist middleware')) return
    warn(...args)
  }
  const { useSystem2Store } = await import('../src/store/system2Store')
  const store = useSystem2Store.getState()

  store.resetToSeed()
  const baseline = useSystem2Store.getState().records
  const baselineCount = baseline.length

  // A snapshot of 3 records that already exist, with their targets moved.
  const changed = baseline.slice(0, 3).map((r) => ({
    id: r.id, division: r.division, team: r.team, location: r.location,
    gradeCode: r.gradeCode, roleTitle: r.roleTitle,
    target: r.target + 100, approvedAt: '2026-09-29T00:00:00.000Z',
  }))
  useSystem2Store.getState().importSnapshot({
    exportedAt: '2026-09-29T00:00:00.000Z', sourceSystem: 'test',
    recordCount: changed.length, records: changed,
  })

  const after = useSystem2Store.getState().records
  const byId = new Map(after.map((r) => [r.id, r]))
  check('merge keeps every pre-existing record', after.length, baselineCount)
  check('no duplicate ids after merge', new Set(after.map((r) => r.id)).size, after.length)
  check('the 3 imported records took their new target', changed.every((c) => byId.get(c.id)!.target === c.target), true)
  check('the other 57 were left untouched',
    baseline.slice(3).every((r) => byId.get(r.id)!.target === r.target), true)

  // Reset must restore the clean baseline, not the merged state.
  useSystem2Store.getState().resetToSeed()
  const reset = useSystem2Store.getState().records
  check('reset restores the seeded baseline count', reset.length, baselineCount)
  check('reset discards merged values', reset.slice(0, 3).every((r, i) => r.target === baseline[i].target), true)
}

console.log()
if (failures > 0) {
  console.error(`${failures} check(s) failed.`)
  process.exit(1)
}
console.log('All ingestion checks passed.')
