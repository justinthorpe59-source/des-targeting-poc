import { useMemo } from 'react'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store } from '../../store/system1Store'
import { useSnapshotStore } from '../../store/snapshotStore'
import { buildSnapshot } from '../engine/buildSnapshot'

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// M13: one-way hand-off to System 2. buildSnapshot() (src/system1/engine/
// buildSnapshot.ts) is the only place the schema and the Approved-only
// filter are implemented — this screen just previews its output and writes
// it to the snapshot bridge store on an explicit click. Never auto-synced.
export function SnapshotExport() {
  const targets = useSystem1Store((state) => state.targets)
  const lastSnapshot = useSnapshotStore((state) => state.lastSnapshot)
  const setSnapshot = useSnapshotStore((state) => state.setSnapshot)

  const preview = useMemo(() => buildSnapshot(SEED_PEOPLE, targets), [targets])

  function handleExport() {
    const snapshot = buildSnapshot(SEED_PEOPLE, targets)
    setSnapshot(snapshot)
    downloadJson(`snapshot-${snapshot.exportedAt.replace(/[:.]/g, '-')}.json`, snapshot)
  }

  const isStale = lastSnapshot !== null && lastSnapshot.recordCount !== preview.recordCount

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Snapshot export</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          One-way hand-off to System 2. Only Approved records are included — nothing else is ever exported.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Approved now (would export)
          </div>
          <div data-testid="export-preview-count" className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {preview.recordCount}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Last exported snapshot</div>
          {lastSnapshot ? (
            <>
              <div data-testid="export-last-count" className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {lastSnapshot.recordCount} record{lastSnapshot.recordCount === 1 ? '' : 's'}
              </div>
              <div data-testid="export-last-timestamp" className="text-xs text-slate-500">
                {lastSnapshot.exportedAt}
              </div>
              {isStale && (
                <div data-testid="export-stale-warning" className="mt-1 text-xs text-amber-700">
                  Out of date — re-export to include the latest Approved records.
                </div>
              )}
            </>
          ) : (
            <div data-testid="export-never" className="mt-1 text-sm text-slate-500">
              Never exported
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        data-testid="export-button"
        onClick={handleExport}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
      >
        Export snapshot ({preview.recordCount} record{preview.recordCount === 1 ? '' : 's'})
      </button>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Division</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2 text-right">Target</th>
              <th className="px-3 py-2">Approved at</th>
            </tr>
          </thead>
          <tbody data-testid="export-preview-rows" className="divide-y divide-slate-100">
            {preview.records.map((record) => (
              <tr key={record.id} data-testid="export-preview-row" data-person-id={record.id}>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{record.id}</td>
                <td className="px-3 py-2 text-slate-600">{record.division}</td>
                <td className="px-3 py-2 text-slate-600">{record.team}</td>
                <td className="px-3 py-2 text-slate-600">{record.location}</td>
                <td className="px-3 py-2 text-slate-600">
                  G{record.gradeCode} {record.roleTitle}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">£{record.target}k</td>
                <td className="px-3 py-2 text-xs text-slate-500">{record.approvedAt}</td>
              </tr>
            ))}
            {preview.records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                  No Approved records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
