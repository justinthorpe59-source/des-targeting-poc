import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSnapshotStore } from '../../store/snapshotStore'
import { useSystem2Store } from '../../store/system2Store'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses } from '../engine/riskStatus'
import type { RiskStatus } from '../engine/riskStatus'
import { computeGoals } from '../engine/goals'
import { round1, statusBadgeClass } from '../riskDisplay'
import { RiskExceptionsSection } from '../components/RiskExceptionsSection'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchDistribution } from '../../components/searchlight/SketchIllustrations'

/**
 * S2-M4: the sponsor-facing front door — goal, coverage, forecast, gap,
 * confidence, top risk drivers. Derived live from aggregate()/
 * computeRiskStatuses()/computeGoals() (S2-M2/M3, and goals.ts's baseline-
 * plus-growth model) — this screen adds no new calculation, only
 * presentation. Goal is prior-year revenue x 1.1 (see goals.ts), not the
 * sum of imported targets — that earlier definition was circular, since it
 * made coverage trivially ~100% by construction.
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

/**
 * Stat tile, reference anatomy: label with a trailing period, a small line
 * icon, a large numeral, and a small grey caption beneath.
 */
function StatTile({
  label,
  value,
  caption,
  icon,
  testId,
}: {
  label: string
  value: ReactNode
  caption: string
  icon: ReactNode
  testId: string
}) {
  return (
    <div className="rounded-pa-card px-6 py-5" style={{ background: 'var(--color-pa-grey-wash)' }}>
      <p className="font-pa-body text-sm font-semibold text-pa-grey-04">{label}</p>
      <span className="mt-3 block text-pa-grey-03" aria-hidden="true">
        {icon}
      </span>
      <p
        data-testid={testId}
        className="mt-3 font-pa-display text-4xl font-medium leading-none tracking-tight text-pa-grey-04"
      >
        {value}
      </p>
      <p className="mt-2 font-pa-body text-[11px] uppercase tracking-[0.1em] text-pa-grey-03">{caption}</p>
    </div>
  )
}

export function ExecutiveSummary() {
  const lastSnapshot = useSnapshotStore((state) => state.lastSnapshot)
  const records = useSystem2Store((state) => state.records)
  const importedAt = useSystem2Store((state) => state.importedAt)
  const importSnapshot = useSystem2Store((state) => state.importSnapshot)

  const rollups = useMemo(() => aggregate(records), [records])
  const goals = useMemo(() => computeGoals(rollups), [rollups])
  const riskStatuses = useMemo(() => computeRiskStatuses(records, rollups, goals), [records, rollups, goals])

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

  const goal = goals.desWide
  const expected = rollups.desWide.expectedAchievement
  const gap = goal - expected
  const coverage = goal > 0 ? (rollups.desWide.target / goal) * 100 : 0
  const desWideRisk = riskStatuses.desWide

  // Lightweight top-3 risk drivers: teams ranked by absolute gap contribution
  // (their own goal vs their own expected achievement — no apportioning of
  // the DES-wide goal down to team level, per the locked rule; each team's
  // goal is independently computed from its own prior-year revenue, see
  // goals.ts). Full, interactive drill-down stays deferred to S2-M6.
  const topDrivers = [...rollups.byTeam.entries()]
    .map(([teamKey, rollup]) => {
      const teamGoal = goals.byTeam.get(teamKey) ?? rollup.target
      return {
        teamKey,
        gap: teamGoal - rollup.expectedAchievement,
        status: riskStatuses.byTeam.get(teamKey)!.status,
      }
    })
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

  /**
   * The hero's gradient carries RISK STATUS, not a brand hue — the spec is
   * explicit that the fill itself is the status indicator, which is where
   * this departs from the reference's flat yellow. Saturated at the left,
   * fading toward the goal edge, in the green/amber/red family.
   */
  const HERO: Record<RiskStatus, { gradient: string; onFill: string }> = {
    'On track': {
      gradient: 'var(--color-pa-lime-03), var(--color-pa-lime-01)',
      onFill: 'var(--color-pa-grey-04)',
    },
    'At risk': {
      gradient: 'var(--color-pa-apricot-03), var(--color-pa-apricot-01)',
      onFill: 'var(--color-pa-grey-04)',
    },
    'Off track': {
      gradient: 'var(--color-pa-rose-04), var(--color-pa-rose-01)',
      onFill: 'var(--color-pa-white)',
    },
    Infeasible: {
      gradient: 'var(--color-pa-ingenuity-red), var(--color-pa-rose-01)',
      onFill: 'var(--color-pa-white)',
    },
  }
  const hero = HERO[desWideRisk.status]

  const forecastPct = desWideRisk.forecastRatio * 100
  /** Goal split by division — the reference's two region pills, carrying our
   *  own breakdown. Three, because DES has three divisions: the pill pattern
   *  is the reference's, the count follows our data. */
  const goalSplit = [...goals.byDivision.entries()]
    .map(([division, value]) => ({ division, pct: goals.desWide > 0 ? (value / goals.desWide) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)

  return (
    <section className="relative">
      {/* Large, low-opacity distribution-curve motif behind the content
          column — texture, not a corner decoration. */}
      <SketchDistribution className="pointer-events-none absolute left-1/2 top-16 -z-10 h-[420px] w-[860px] max-w-none -translate-x-1/2 opacity-[0.06]" />

      {/* Header: org name + one-line grey subtitle left, single icon right. */}
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-pa-body text-sm font-bold text-pa-grey-04">Design, Engineering &amp; Science</h1>
          <p className="mt-1 font-pa-body text-sm text-pa-grey-03">Organisational operating summary.</p>
        </div>
        <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" fill="var(--color-pa-grey-04)">
          <rect x="1" y="9" width="3" height="6" rx="0.5" />
          <rect x="6.5" y="1" width="3" height="14" rx="0.5" />
          <rect x="12" y="6" width="3" height="9" rx="0.5" />
        </svg>
      </header>

      {loading ? (
        <div className="py-24">
          <SearchlightLoader />
        </div>
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out]">
          {/* Generous vertical whitespace above the body — this screen should
              feel calm and editorial, not dense. */}
          <div className="grid gap-12 pb-24 pt-32 lg:grid-cols-[35fr_65fr] lg:gap-16">
            {/* ---- Left: the organisational goal, as the dominant element ---- */}
            <div>
              <p className="font-pa-body text-sm font-semibold text-pa-grey-04">Organisational goal.</p>
              <p
                data-testid="s2-exec-goal"
                className="mt-4 font-pa-display text-[5.5rem] font-medium leading-[0.95] tracking-tight text-pa-grey-04"
              >
                £{(goal / 1000).toFixed(2)}m
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {goalSplit.map(({ division, pct }) => (
                  <span
                    key={division}
                    data-testid="s2-exec-goal-split"
                    className="rounded-pa-chip px-2.5 py-1 font-pa-body text-xs text-pa-grey-03"
                    style={{ background: 'var(--color-pa-grey-01)' }}
                  >
                    {round1(pct)}% {division}
                  </span>
                ))}
              </div>

              <p className="mt-6 max-w-sm font-pa-body text-sm leading-relaxed text-pa-grey-03">
                Prior-year revenue plus 10%, computed per team and rolled up — never apportioned down from the
                DES-wide figure. £{round1(goal)}k across {records.length} approved records.
              </p>
            </div>

            {/* ---- Right: the signature gap/forecast visualisation ---- */}
            <div className="space-y-4">
              <div
                data-testid="s2-exec-forecast-hero"
                data-status={desWideRisk.status}
                className="relative overflow-hidden rounded-pa-card"
                style={{ background: 'var(--color-pa-grey-wash)' }}
              >
                {/* Proportional fill: its WIDTH is the forecast ratio and its
                    HUE is the risk status, so the one mark carries both. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.min(forecastPct, 100)}%`,
                    backgroundImage: `linear-gradient(to right, ${hero.gradient})`,
                  }}
                />
                <div className="relative flex items-start justify-between gap-6 px-7 pb-8 pt-6">
                  {/*
                    Text colour follows the fill it sits on, measured rather
                    than assumed: Grey 04 on Ingenuity Red is 2.45:1, nowhere
                    near AA. The red statuses therefore take white, and the
                    label is set at 18px semibold so it qualifies as WCAG
                    large text (3:1), where white-on-red reaches 3.9:1. The
                    light statuses keep Grey 04, which clears AA comfortably.
                  */}
                  <div>
                    <p className="font-pa-body text-lg font-semibold" style={{ color: hero.onFill }}>
                      Forecast.
                    </p>
                    <p
                      data-testid="s2-exec-forecast"
                      className="mt-3 font-pa-display text-5xl font-medium leading-none tracking-tight"
                      style={{ color: hero.onFill }}
                    >
                      {round1(forecastPct)}%
                    </p>
                    <p
                      data-testid="s2-exec-gap"
                      className="mt-2 font-pa-body text-sm font-medium"
                      style={{ color: hero.onFill }}
                    >
                      {gap >= 0 ? '−' : '+'}£{round1(Math.abs(gap))}k {gap >= 0 ? 'short of' : 'above'} goal
                    </p>
                  </div>
                  <p className="shrink-0 font-pa-body text-sm text-pa-grey-03">Target FY26.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <StatTile
                  label="Coverage."
                  testId="s2-exec-coverage"
                  value={`${round1(coverage)}%`}
                  caption="Allocated targets vs goal"
                  icon={
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <circle cx="10" cy="10" r="7" />
                      <path d="M10 3a7 7 0 0 1 7 7h-7Z" fill="currentColor" stroke="none" />
                    </svg>
                  }
                />
                <StatTile
                  label="Confidence."
                  testId="s2-exec-confidence"
                  value={desWideRisk.confidence}
                  caption="Simulated — illustrative only"
                  icon={
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M3 13.5 7 9l3.5 3L17 5.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M13 5.5h4v4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                />
              </div>

              {/* The plain-language risk sentence. It used to sit beside a
                  large status word in the old hero; that hero is gone, but
                  the sentence is the "why" behind the forecast and belongs
                  with it rather than being dropped. */}
              {desWideRisk.status === 'On track' ? (
                <p data-testid="s2-exec-risk-statement" className="font-pa-body text-sm text-pa-grey-04">
                  On track to meet the £{round1(goal)}k goal — forecasting £{round1(expected)}k.
                </p>
              ) : (
                <p data-testid="s2-exec-risk-statement" className="font-pa-body text-sm text-pa-grey-04">
                  <span data-testid="s2-exec-status" data-status={desWideRisk.status} className="font-semibold">
                    {desWideRisk.status}
                  </span>{' '}
                  — we risk missing the £{round1(goal)}k goal{gap > 0 ? ` by £${round1(gap)}k` : ''}
                  {joinedDrivers ? `, due to ${joinedDrivers}` : ''}.
                </p>
              )}

              {desWideRisk.concentrationFlagged && (
                <p data-testid="s2-exec-concentration" className="font-pa-body text-xs text-pa-apricot-04">
                  Concentration risk flagged.
                </p>
              )}
            </div>
          </div>

          {/* Footer rule: caption left. The reference's right-hand page index
              ("01 / 12") is deliberately dropped — a print-report artefact
              with nothing to paginate against in a live app. */}
          <div className="flex items-center justify-between border-t border-pa-grey-01 pt-4">
            <p className="font-pa-body text-[11px] uppercase tracking-[0.12em] text-pa-grey-03">
              {records.length} record{records.length === 1 ? '' : 's'} imported from System 1
              {importedAt ? ` · ${importedAt}` : ''}
            </p>
          </div>

          <div className="space-y-8 pt-16">
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

            <div className="border-t border-pa-grey-01 pt-6">
              <RiskExceptionsSection />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
