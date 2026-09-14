import { useSnapshotStore } from '../../store/snapshotStore'
import { useSystem2Store } from '../../store/system2Store'

// S2-M1: demoValue is gone from system2Store, so this placeholder now
// exercises the real thing instead — reads the exported snapshot (the only
// sanctioned bridge from System 1) and imports it as System 2's own copy.
// Real screens (Executive summary etc.) replace this starting S2-M4; until
// then this is both the placeholder AND the only way to trigger an import
// through the UI.
export function ScreenA() {
  const lastSnapshot = useSnapshotStore((state) => state.lastSnapshot)
  const records = useSystem2Store((state) => state.records)
  const importedAt = useSystem2Store((state) => state.importedAt)
  const importSnapshot = useSystem2Store((state) => state.importSnapshot)

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">Screen A (S2-M1 placeholder)</h1>
      <p className="max-w-md text-sm text-slate-600">
        Imports System 1's exported snapshot into System 2's own store. Switch to Screen B — it should
        already show the same imported count, with no reload.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-xs text-slate-500">Available to import (System 1's last export)</div>
        <div data-testid="s2-available-count" className="text-2xl font-bold tabular-nums text-slate-900">
          {lastSnapshot ? lastSnapshot.recordCount : '—'}
        </div>
        {lastSnapshot && (
          <div className="text-xs text-slate-500">exported {lastSnapshot.exportedAt}</div>
        )}
      </div>

      <button
        type="button"
        data-testid="s2-import-button"
        disabled={!lastSnapshot}
        onClick={() => lastSnapshot && importSnapshot(lastSnapshot)}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Import snapshot
      </button>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-xs text-slate-500">Imported into System 2</div>
        <div data-testid="s2-imported-count" className="text-2xl font-bold tabular-nums text-slate-900">
          {records.length}
        </div>
        {importedAt && <div data-testid="s2-imported-at" className="text-xs text-slate-500">imported {importedAt}</div>}
      </div>
    </section>
  )
}
