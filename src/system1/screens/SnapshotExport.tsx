import { useMemo } from 'react'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store } from '../../store/system1Store'
import { useSnapshotStore } from '../../store/snapshotStore'
import { buildSnapshot } from '../engine/buildSnapshot'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchSurface } from '../../components/searchlight/SketchIllustrations'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'

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

// M13: one-way hand-off to System 2. buildSnapshot() is the only place the
// schema and the Approved-only filter live — this screen previews its output
// and writes it to the snapshot bridge store on an explicit confirm. Never
// auto-synced. Searchlight design pass: a real review/confirm screen (per the
// locked spec, over the PO's "just a file?") — token styling, an aggregate
// summary, and an explicit note that it syncs live to System 2.
export function SnapshotExport() {
  const targets = useSystem1Store((state) => state.targets)
  const lastSnapshot = useSnapshotStore((state) => state.lastSnapshot)
  const setSnapshot = useSnapshotStore((state) => state.setSnapshot)
  const loading = useInitialLoad(true)

  const preview = useMemo(() => buildSnapshot(SEED_PEOPLE, targets), [targets])
  const aggregate = useMemo(() => preview.records.reduce((sum, r) => sum + r.target, 0), [preview])

  function handleExport() {
    const snapshot = buildSnapshot(SEED_PEOPLE, targets)
    setSnapshot(snapshot)
    downloadJson(`snapshot-${snapshot.exportedAt.replace(/[:.]/g, '-')}.json`, snapshot)
  }

  const isStale = lastSnapshot !== null && lastSnapshot.recordCount !== preview.recordCount

  return (
    <section className="relative space-y-6">
      <SketchSurface className="pointer-events-none absolute right-0 top-6 -z-10 h-[320px] w-[460px] max-w-none opacity-[0.05]" />

      <div>
        <h1 className="font-pa-display text-3xl font-semibold leading-tight text-pa-grey-04">Snapshot export</h1>
        <p className="mt-1 max-w-xl font-pa-body text-sm text-pa-grey-03">
          One-way hand-off to System 2. Only Approved records are included — nothing else is ever exported.
        </p>
      </div>

      {loading ? (
        <SearchlightLoader />
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-6">
          {/* Summary of what will be exported */}
          <div className="grid grid-cols-1 divide-x divide-y divide-pa-grey-01 overflow-hidden rounded-xl border border-pa-grey-01 bg-pa-white sm:grid-cols-3 sm:divide-y-0">
            <div className="relative px-4 py-3">
              <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: 'var(--color-pa-lime-03)' }} />
              <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
                Approved now (would export)
              </div>
              <div data-testid="export-preview-count" className="mt-1 font-pa-mono text-2xl font-bold text-pa-grey-04">
                {preview.recordCount}
              </div>
            </div>
            <div className="relative px-4 py-3">
              <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: 'var(--color-pa-aqua-04)' }} />
              <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
                Aggregate target
              </div>
              <div className="mt-1 font-pa-mono text-2xl font-bold text-pa-grey-04">£{aggregate.toLocaleString()}k</div>
              <div className="font-pa-body text-[11px] text-pa-grey-03">sum of Approved targets</div>
            </div>
            <div className="relative px-4 py-3">
              <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: 'var(--color-pa-grey-02)' }} />
              <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
                Last exported snapshot
              </div>
              {lastSnapshot ? (
                <>
                  <div data-testid="export-last-count" className="mt-1 font-pa-mono text-2xl font-bold text-pa-grey-04">
                    {lastSnapshot.recordCount} record{lastSnapshot.recordCount === 1 ? '' : 's'}
                  </div>
                  <div data-testid="export-last-timestamp" className="font-pa-mono text-[11px] text-pa-grey-03">
                    {lastSnapshot.exportedAt}
                  </div>
                  {isStale && (
                    <div
                      data-testid="export-stale-warning"
                      className="mt-1 inline-block rounded bg-pa-apricot-01 px-1.5 py-0.5 font-pa-body text-[11px] text-pa-grey-04"
                    >
                      Out of date — re-export to include the latest Approved records.
                    </div>
                  )}
                </>
              ) : (
                <div data-testid="export-never" className="mt-1 font-pa-body text-sm text-pa-grey-03">
                  Never exported
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="export-button"
              onClick={handleExport}
              disabled={preview.recordCount === 0}
              className="rounded-md bg-pa-aqua-05 px-3 py-1.5 font-pa-body text-sm font-medium text-pa-white hover:bg-pa-aqua-04 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm export ({preview.recordCount} record{preview.recordCount === 1 ? '' : 's'})
            </button>
            <p className="font-pa-body text-xs text-pa-grey-03">
              Writes this snapshot to the System 2 bridge immediately — System 2 reads it live, no file upload
              needed. A JSON file also downloads for the manual hand-off path.
            </p>
          </div>

          <div>
            <h2 className="mb-2 font-pa-display text-sm font-semibold text-pa-grey-04">Records included</h2>
            <div className="overflow-x-auto rounded-lg border border-pa-grey-01 bg-pa-white">
              <table className="min-w-full divide-y divide-pa-grey-01 font-pa-body text-sm">
                <thead className="bg-pa-grey-wash text-left text-xs font-medium uppercase tracking-wide text-pa-grey-03">
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
                <tbody data-testid="export-preview-rows" className="divide-y divide-pa-grey-01">
                  {preview.records.map((record) => (
                    <tr key={record.id} data-testid="export-preview-row" data-person-id={record.id}>
                      <td className="px-3 py-2 font-pa-mono text-xs text-pa-grey-03">{record.id}</td>
                      <td className="px-3 py-2 text-pa-grey-04">{record.division}</td>
                      <td className="px-3 py-2 text-pa-grey-04">{record.team}</td>
                      <td className="px-3 py-2 text-pa-grey-04">{record.location}</td>
                      <td className="px-3 py-2 text-pa-grey-04">
                        G{record.gradeCode} {record.roleTitle}
                      </td>
                      <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">£{record.target}k</td>
                      <td className="px-3 py-2 font-pa-mono text-xs text-pa-grey-03">{record.approvedAt}</td>
                    </tr>
                  ))}
                  {preview.records.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center font-pa-body text-sm text-pa-grey-03">
                        No Approved records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
