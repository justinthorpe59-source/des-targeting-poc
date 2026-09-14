import { useMemo } from 'react'
import { useSnapshotStore } from '../../store/snapshotStore'
import { useSystem2Store } from '../../store/system2Store'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses } from '../engine/riskStatus'
import { round1, statusBadgeClass } from '../riskDisplay'

/**
 * S2-M4: the sponsor-facing front door — goal, coverage, forecast, gap,
 * confidence, top risk drivers. Everything here is derived live from
 * aggregate()/computeRiskStatuses() (S2-M2/M3), the same engines ScreenB
 * exercises — this screen adds no new calculation, only presentation.
 *
 * The empty state (no snapshot imported yet) is this screen's real first-run
 * state, not a placeholder edge case, and it's the one place the "Import
 * from System 1" action lives — S2-M1's ScreenA existed only to exercise
 * that action before a real screen claimed it.
 */
export function ExecutiveSummary() {
  const lastSnapshot = useSnapshotStore((state) => state.lastSnapshot)
  const records = useSystem2Store((state) => state.records)
  const importedAt = useSystem2Store((state) => state.importedAt)
  const importSnapshot = useSystem2Store((state) => state.importSnapshot)

  const rollups = useMemo(() => aggregate(records), [records])
  const riskStatuses = useMemo(() => computeRiskStatuses(records, rollups), [records, rollups])

  if (records.length === 0) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Executive summary</h1>
          <p className="mt-1 max-w-md text-sm text-slate-600">
            Tells leadership whether DES is on track to hit its goal. Import an Approved snapshot from
            System 1 to get started — System 2 never reads System 1's live data directly.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Available to import (System 1&apos;s last export)</div>
          <div data-testid="s2-available-count" className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {lastSnapshot ? lastSnapshot.recordCount : '—'}
          </div>
          {lastSnapshot ? (
            <div className="mt-0.5 text-xs text-slate-500">exported {lastSnapshot.exportedAt}</div>
          ) : (
            <div className="mt-0.5 text-xs text-slate-500">
              Nothing exported yet — approve records and export a snapshot in System 1 first.
            </div>
          )}
        </div>

        <button
          type="button"
          data-testid="s2-import-button"
          disabled={!lastSnapshot}
          onClick={() => lastSnapshot && importSnapshot(lastSnapshot)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Import from System 1
        </button>
      </section>
    )
  }

  const goal = rollups.desWide.target
  const expected = rollups.desWide.expectedAchievement
  const gap = goal - expected
  const coverage = goal > 0 ? (rollups.desWide.target / goal) * 100 : 0
  const desWideRisk = riskStatuses.desWide

  // Lightweight top-3 risk drivers: teams ranked by absolute gap contribution
  // (their own target vs their own expected achievement — no apportioning
  // of the DES-wide goal down to team level, per the locked rule). Full,
  // interactive drill-down stays deferred to S2-M6.
  const topDrivers = [...rollups.byTeam.entries()]
    .map(([teamKey, rollup]) => ({
      teamKey,
      gap: rollup.target - rollup.expectedAchievement,
      status: riskStatuses.byTeam.get(teamKey)!.status,
    }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 3)

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Executive summary</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          {records.length} record{records.length === 1 ? '' : 's'} imported from System 1
          {importedAt ? ` · ${importedAt}` : ''}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Goal</div>
          <div data-testid="s2-exec-goal" className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            £{round1(goal)}k
          </div>
          <div className="mt-0.5 text-xs text-slate-500">sum of imported targets, by construction</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Coverage</div>
          <div data-testid="s2-exec-coverage" className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {round1(coverage)}%
          </div>
          <div className="mt-0.5 text-xs text-slate-500">starts at 100% until a goal is changed (S2-M7)</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Forecast</div>
          <div data-testid="s2-exec-forecast" className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {round1(desWideRisk.forecastRatio * 100)}%
          </div>
          <div className="mt-0.5 text-xs text-slate-500">£{round1(expected)}k expected achievement</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Gap</div>
          <div data-testid="s2-exec-gap" className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {gap >= 0 ? '−' : '+'}£{round1(Math.abs(gap))}k
          </div>
          <div className="mt-0.5 text-xs text-slate-500">{gap >= 0 ? 'shortfall vs goal' : 'surplus vs goal'}</div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span
            data-testid="s2-exec-status"
            data-status={desWideRisk.status}
            className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(desWideRisk.status)}`}
          >
            {desWideRisk.status}
          </span>
          <span className="text-xs text-slate-500">
            confidence (simulated, illustrative only):{' '}
            <span data-testid="s2-exec-confidence">{desWideRisk.confidence}</span>
          </span>
          {desWideRisk.concentrationFlagged && (
            <span data-testid="s2-exec-concentration" className="text-xs text-amber-700">
              concentration risk flagged
            </span>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700">Top risk drivers</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2 text-right">Gap</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody data-testid="s2-exec-top-drivers">
              {topDrivers.map((driver) => (
                <tr key={driver.teamKey} data-testid="s2-exec-driver-row" className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{driver.teamKey.replace('::', ' / ')}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    {driver.gap >= 0 ? '−' : '+'}£{round1(Math.abs(driver.gap))}k
                  </td>
                  <td className="px-3 py-2">
                    <span
                      data-status={driver.status}
                      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(driver.status)}`}
                    >
                      {driver.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
