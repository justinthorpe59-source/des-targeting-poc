import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSnapshotStore } from '../../store/snapshotStore'
import { useSystem2Store } from '../../store/system2Store'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses } from '../engine/riskStatus'
import type { RiskStatus } from '../engine/riskStatus'
import { round1, statusBadgeClass } from '../riskDisplay'
import { CoverageTrack } from '../components/CoverageTrack'
import { SearchlightLoader } from '../components/SearchlightLoader'
import { SketchDistribution } from '../components/SketchIllustrations'

/**
 * S2-M4: the sponsor-facing front door — goal, coverage, forecast, gap,
 * confidence, top risk drivers. Everything here is derived live from
 * aggregate()/computeRiskStatuses() (S2-M2/M3), the same engines ScreenB
 * exercises — this screen adds no new calculation, only presentation.
 *
 * The empty state (no snapshot imported yet) is this screen's real first-run
 * state, not a placeholder edge case, and it's the one place the "Import
 * from System 1" action lives.
 *
 * Searchlight design pass (visual only, no calculation changes). Dark Blue
 * (#00172D) is deliberately absent from this screen: Grey 04 anchors the
 * headers, Aqua 05 is the dark base the searchlight beam sweeps across.
 * Severity pills come from the shared statusBadgeClass (riskDisplay) so the
 * four risk states read identically here and across the other System 2
 * screens. The hero status word keeps its own text-only colour helper below.
 */
// The big hero status word, coloured by severity (text only, no chip).
function execStatusWordColor(status: RiskStatus): string {
  switch (status) {
    case 'On track':
      return 'text-pa-aqua-05'
    case 'At risk':
      return 'text-pa-apricot-04'
    case 'Off track':
      return 'text-pa-rose-04'
    case 'Infeasible':
      return 'text-pa-ingenuity-red'
  }
}

function MetricCell({
  label,
  value,
  sub,
  rule,
  testId,
}: {
  label: string
  value: ReactNode
  sub: string
  rule: string
  testId?: string
}) {
  return (
    <div className="relative px-4 py-3">
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: rule }} />
      <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">{label}</div>
      <div data-testid={testId} className="mt-1 font-pa-mono text-lg font-bold text-pa-grey-04">
        {value}
      </div>
      <div className="mt-0.5 font-pa-body text-[11px] text-pa-grey-03">{sub}</div>
    </div>
  )
}

export function ExecutiveSummary() {
  const lastSnapshot = useSnapshotStore((state) => state.lastSnapshot)
  const records = useSystem2Store((state) => state.records)
  const importedAt = useSystem2Store((state) => state.importedAt)
  const importSnapshot = useSystem2Store((state) => state.importSnapshot)

  const rollups = useMemo(() => aggregate(records), [records])
  const riskStatuses = useMemo(() => computeRiskStatuses(records, rollups), [records, rollups])

  const hasRecords = records.length > 0
  const [loading, setLoading] = useState(hasRecords)
  useEffect(() => {
    if (!hasRecords) return
    const timer = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(timer)
  }, [hasRecords])

  if (records.length === 0) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="font-pa-display text-4xl font-semibold text-pa-grey-04">Executive summary</h1>
          <p className="mt-2 max-w-md font-pa-body text-sm text-pa-grey-03">
            Tells leadership whether DES is on track to hit its goal. Import an Approved snapshot from
            System 1 to get started — System 2 never reads System 1&apos;s live data directly.
          </p>
        </div>

        <div className="rounded-lg border border-pa-grey-01 bg-pa-white p-4">
          <div className="font-pa-body text-xs text-pa-grey-03">Available to import (System 1&apos;s last export)</div>
          <div data-testid="s2-available-count" className="mt-1 font-pa-mono text-2xl font-bold tabular-nums text-pa-grey-04">
            {lastSnapshot ? lastSnapshot.recordCount : '—'}
          </div>
          {lastSnapshot ? (
            <div className="mt-0.5 font-pa-body text-xs text-pa-grey-03">exported {lastSnapshot.exportedAt}</div>
          ) : (
            <div className="mt-0.5 font-pa-body text-xs text-pa-grey-03">
              Nothing exported yet — approve records and export a snapshot in System 1 first.
            </div>
          )}
        </div>

        <button
          type="button"
          data-testid="s2-import-button"
          disabled={!lastSnapshot}
          onClick={() => lastSnapshot && importSnapshot(lastSnapshot)}
          className="rounded-md bg-pa-aqua-05 px-3 py-1.5 font-pa-body text-sm font-medium text-pa-white hover:bg-pa-aqua-04 disabled:cursor-not-allowed disabled:opacity-40"
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

  // Locked-spec.md: "clear, direct risk language ... rather than narrative
  // framing" — a single causal sentence naming the actual reasons. The cited
  // team must itself be non-compliant — topDrivers ranks by absolute gap
  // regardless of direction, so its #1 entry can be a team that's ahead of
  // target (a large surplus), which would read as a "risk driver" while
  // actually being a bright spot.
  const riskiestDriver = topDrivers.find((d) => d.status !== 'On track')
  const riskDrivers: string[] = []
  if (desWideRisk.confidence === 'Low') riskDrivers.push('low confidence in the forecast')
  if (desWideRisk.concentrationFlagged) riskDrivers.push('revenue concentrated in a small share of contributors')
  if (riskiestDriver) riskDrivers.push(`${riskiestDriver.teamKey.replace('::', ' / ')} running ${riskiestDriver.status}`)
  const joinedDrivers =
    riskDrivers.length <= 1 ? (riskDrivers[0] ?? '') : `${riskDrivers.slice(0, -1).join(', ')} and ${riskDrivers[riskDrivers.length - 1]}`

  return (
    <section className="relative space-y-8">
      {/* Large, low-opacity distribution-curve motif behind the content
          column — texture, not a corner decoration. */}
      <SketchDistribution className="pointer-events-none absolute left-1/2 top-16 -z-10 h-[420px] w-[860px] max-w-none -translate-x-1/2 opacity-[0.06]" />

      <div>
        <h1 className="font-pa-display text-4xl font-semibold leading-tight text-pa-grey-04">Executive summary</h1>
        <p className="mt-1 font-pa-body text-sm text-pa-grey-03">
          {records.length} record{records.length === 1 ? '' : 's'} imported from System 1
          {importedAt ? ` · ${importedAt}` : ''}.
        </p>
      </div>

      {loading ? (
        <SearchlightLoader />
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-8">
          {/* Hero: the status word large in its severity colour, no card, with
              the plain-language risk sentence alongside it. */}
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <span
              data-testid="s2-exec-status-word"
              data-status={desWideRisk.status}
              className={`font-pa-display text-[40px] font-semibold leading-none ${execStatusWordColor(desWideRisk.status)}`}
            >
              {desWideRisk.status}
            </span>
            {desWideRisk.status === 'On track' ? (
              <p data-testid="s2-exec-risk-statement" className="max-w-2xl font-pa-body text-base text-pa-grey-04">
                On track to meet the £{round1(goal)}k goal — forecasting £{round1(expected)}k ({round1(coverage)}% coverage).
              </p>
            ) : (
              <p data-testid="s2-exec-risk-statement" className="max-w-2xl font-pa-body text-base text-pa-grey-04">
                We risk missing the £{round1(goal)}k goal{gap > 0 ? ` by £${round1(gap)}k` : ''}
                {joinedDrivers ? `, due to ${joinedDrivers}` : ''}.
              </p>
            )}
          </div>

          {/* Signature visualisation. */}
          <CoverageTrack goal={goal} expected={expected} gap={gap} status={desWideRisk.status} />

          {/* One divided white surface — not four separate cards. */}
          <div className="grid grid-cols-2 divide-x divide-y divide-pa-grey-01 overflow-hidden rounded-xl border border-pa-grey-01 bg-pa-white sm:grid-cols-4 sm:divide-y-0">
            <MetricCell
              label="Goal"
              testId="s2-exec-goal"
              value={<>£{round1(goal)}k</>}
              sub="sum of imported targets"
              rule="var(--color-pa-grey-02)"
            />
            <MetricCell
              label="Coverage"
              testId="s2-exec-coverage"
              value={`${round1(coverage)}%`}
              sub="100% until goal changes (S2-M7)"
              rule="var(--color-pa-aqua-04)"
            />
            <MetricCell
              label="Forecast"
              testId="s2-exec-forecast"
              value={`${round1(desWideRisk.forecastRatio * 100)}%`}
              sub={`£${round1(expected)}k expected`}
              rule="var(--color-pa-aqua-03)"
            />
            <MetricCell
              label="Gap"
              testId="s2-exec-gap"
              value={
                <span className={gap < 0 ? 'text-pa-lime-04' : gap > 0 ? 'text-pa-ingenuity-red' : undefined}>
                  {gap >= 0 ? '−' : '+'}£{round1(Math.abs(gap))}k
                </span>
              }
              sub={gap >= 0 ? 'shortfall vs goal' : 'surplus vs goal'}
              rule={gap > 0 ? 'var(--color-pa-ingenuity-red)' : 'var(--color-pa-lime-03)'}
            />
          </div>

          {/* Status + confidence line. */}
          <div className="flex flex-wrap items-center gap-3">
            <span
              data-testid="s2-exec-status"
              data-status={desWideRisk.status}
              className={`inline-block rounded px-2 py-0.5 font-pa-body text-xs font-semibold ${statusBadgeClass(desWideRisk.status)}`}
            >
              {desWideRisk.status}
            </span>
            <span className="font-pa-body text-xs text-pa-grey-03">
              confidence (simulated, illustrative only):{' '}
              <span data-testid="s2-exec-confidence" className="font-pa-mono">
                {desWideRisk.confidence}
              </span>
            </span>
            {desWideRisk.concentrationFlagged && (
              <span data-testid="s2-exec-concentration" className="font-pa-body text-xs text-pa-apricot-04">
                concentration risk flagged
              </span>
            )}
          </div>

          <div>
            <h2 className="font-pa-display text-base font-semibold text-pa-grey-04">Top risk drivers</h2>
            <div className="mt-2 overflow-x-auto rounded-lg border border-pa-grey-01 bg-pa-white">
              <table className="min-w-full divide-y divide-pa-grey-01 font-pa-body text-sm">
                <thead className="bg-pa-grey-wash text-left text-xs font-medium uppercase tracking-wide text-pa-grey-03">
                  <tr>
                    <th className="px-3 py-2">Team</th>
                    <th className="px-3 py-2 text-right">Gap</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody data-testid="s2-exec-top-drivers">
                  {topDrivers.map((driver) => (
                    <tr key={driver.teamKey} data-testid="s2-exec-driver-row" className="border-t border-pa-grey-01">
                      <td className="px-3 py-2 font-medium text-pa-grey-04">{driver.teamKey.replace('::', ' / ')}</td>
                      <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">
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
        </div>
      )}
    </section>
  )
}
