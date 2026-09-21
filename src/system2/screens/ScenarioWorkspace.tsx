import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Division } from '../../system1/data/types'
import { useSystem2Store } from '../../store/system2Store'
import { useScenarioStore } from '../../store/scenarioStore'
import { aggregate } from '../engine/aggregation'
import { computeRiskStatuses, type Confidence } from '../engine/riskStatus'
import { runScenario, type ScenarioLevers } from '../engine/scenario'
import { round1, statusBadgeClass } from '../riskDisplay'
import { KpiTile } from '../components/KpiTile'
import { ScreenHeading } from '../../components/searchlight/ScreenHeading'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchGrid } from '../../components/searchlight/SketchIllustrations'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'

const selectClass =
  'rounded-md border border-pa-grey-02 bg-pa-white px-2 py-1.5 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none'
const inputClass =
  'rounded-md border border-pa-grey-02 px-2 py-1.5 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none'

interface WorkspaceInputs {
  goalEnabled: boolean
  goal: number
  capacityEnabled: boolean
  capacityLevel: 'division' | 'team'
  capacityDivision: Division | ''
  capacityTeam: string
  capacityPercent: number
  populationEnabled: boolean
  populationPercent: number
  groupEnabled: boolean
  groupLevel: 'desWide' | 'division' | 'team'
  groupDivision: Division | ''
  groupTeam: string
  groupExpectedAchievementEnabled: boolean
  groupExpectedAchievement: number
  groupConfidenceEnabled: boolean
  groupConfidence: Confidence
}

function defaultInputs(goal: number): WorkspaceInputs {
  return {
    goalEnabled: false,
    goal,
    capacityEnabled: false,
    capacityLevel: 'division',
    capacityDivision: '',
    capacityTeam: '',
    capacityPercent: 0,
    populationEnabled: false,
    populationPercent: 0,
    groupEnabled: false,
    groupLevel: 'division',
    groupDivision: '',
    groupTeam: '',
    groupExpectedAchievementEnabled: false,
    groupExpectedAchievement: 0,
    groupConfidenceEnabled: false,
    groupConfidence: 'Medium',
  }
}

function leversFrom(inputs: WorkspaceInputs): ScenarioLevers {
  const levers: ScenarioLevers = {}

  if (inputs.goalEnabled) levers.goal = inputs.goal

  if (inputs.capacityEnabled && inputs.capacityDivision) {
    levers.capacityChange = {
      scope:
        inputs.capacityLevel === 'division'
          ? { level: 'division', division: inputs.capacityDivision }
          : { level: 'team', division: inputs.capacityDivision, team: inputs.capacityTeam },
      multiplier: 1 + inputs.capacityPercent / 100,
    }
  }

  if (inputs.populationEnabled && inputs.populationPercent !== 0) {
    levers.populationAdjustmentPercent = inputs.populationPercent
  }

  if (inputs.groupEnabled && (inputs.groupExpectedAchievementEnabled || inputs.groupConfidenceEnabled)) {
    const target =
      inputs.groupLevel === 'desWide'
        ? { level: 'desWide' as const }
        : inputs.groupLevel === 'division'
          ? { level: 'division' as const, division: inputs.groupDivision || undefined }
          : { level: 'team' as const, division: inputs.groupDivision || undefined, team: inputs.groupTeam }

    if (inputs.groupLevel === 'desWide' || inputs.groupDivision) {
      levers.groupOverride = {
        target,
        expectedAchievement: inputs.groupExpectedAchievementEnabled ? inputs.groupExpectedAchievement : undefined,
        confidence: inputs.groupConfidenceEnabled ? inputs.groupConfidence : undefined,
      }
    }
  }

  return levers
}

/**
 * S2-M7: the four locked levers, computed as a non-committing "what if" —
 * never writes to system2Store. Local component state feeds the SAME real
 * engine functions (aggregate()/computeRiskStatuses(), via runScenario())
 * that every other System 2 screen uses on the real data, just with
 * hypothetical inputs. Baseline is always computed from the untouched real
 * records. Searchlight design pass added the loader, grid motif and token
 * styling; all lever logic is unchanged.
 */
export function ScenarioWorkspace() {
  const records = useSystem2Store((state) => state.records)
  const savedScenarios = useScenarioStore((state) => state.scenarios)
  const saveScenario = useScenarioStore((state) => state.saveScenario)
  const deleteScenario = useScenarioStore((state) => state.deleteScenario)

  const baselineAggregation = useMemo(() => aggregate(records), [records])
  const baselineRisk = useMemo(() => computeRiskStatuses(records, baselineAggregation), [records, baselineAggregation])

  const [inputs, setInputs] = useState<WorkspaceInputs>(() => defaultInputs(baselineAggregation.desWide.target))
  const [scenarioName, setScenarioName] = useState('')
  const loading = useInitialLoad(records.length > 0)

  const levers = useMemo(() => leversFrom(inputs), [inputs])
  const scenario = useMemo(() => runScenario(records, levers), [records, levers])

  if (records.length === 0) {
    return (
      <section className="space-y-4">
        <ScreenHeading title="Scenario workspace">
          Test a change and see the effect before committing to anything — nothing here is ever saved to
          the imported snapshot.
        </ScreenHeading>
        <div className="rounded-lg border border-pa-grey-01 bg-pa-white p-4 font-pa-body text-sm text-pa-grey-03">
          No snapshot imported yet.{' '}
          <Link to="/system2/executive-summary" className="font-medium text-pa-aqua-05 underline">
            Import from System 1
          </Link>{' '}
          on Executive summary first.
        </div>
      </section>
    )
  }

  const divisions = [...baselineAggregation.byDivision.keys()]
  const teamsForCapacityDivision = inputs.capacityDivision
    ? [...baselineAggregation.byTeam.keys()]
        .filter((key) => key.startsWith(`${inputs.capacityDivision}::`))
        .map((key) => key.split('::')[1])
    : []
  const teamsForGroupDivision = inputs.groupDivision
    ? [...baselineAggregation.byTeam.keys()]
        .filter((key) => key.startsWith(`${inputs.groupDivision}::`))
        .map((key) => key.split('::')[1])
    : []

  const baselineGoal = baselineAggregation.desWide.target
  const scenarioGoal = levers.goal ?? scenario.aggregation.desWide.target
  const isTweaked = Object.keys(levers).length > 0

  // The specific group a scoped lever targets, if any — shown as its own
  // baseline-vs-scenario row beneath the DES-wide comparison.
  const scopedGroupKey =
    levers.capacityChange?.scope.level === 'team'
      ? `${levers.capacityChange.scope.division}::${levers.capacityChange.scope.team}`
      : levers.capacityChange?.scope.level === 'division'
        ? levers.capacityChange.scope.division
        : levers.groupOverride?.target.level === 'team'
          ? `${levers.groupOverride.target.division}::${levers.groupOverride.target.team}`
          : levers.groupOverride?.target.level === 'division'
            ? levers.groupOverride.target.division
            : null
  const scopedIsTeam = scopedGroupKey?.includes('::') ?? false
  const baselineScopedRollup = scopedGroupKey
    ? scopedIsTeam
      ? baselineAggregation.byTeam.get(scopedGroupKey)
      : baselineAggregation.byDivision.get(scopedGroupKey as Division)
    : undefined
  const baselineScopedRisk = scopedGroupKey
    ? scopedIsTeam
      ? baselineRisk.byTeam.get(scopedGroupKey)
      : baselineRisk.byDivision.get(scopedGroupKey as Division)
    : undefined
  const scenarioScopedRollup = scopedGroupKey
    ? scopedIsTeam
      ? scenario.aggregation.byTeam.get(scopedGroupKey)
      : scenario.aggregation.byDivision.get(scopedGroupKey as Division)
    : undefined
  const scenarioScopedRisk = scopedGroupKey
    ? scopedIsTeam
      ? scenario.riskStatuses.byTeam.get(scopedGroupKey)
      : scenario.riskStatuses.byDivision.get(scopedGroupKey as Division)
    : undefined

  return (
    <section className="relative space-y-6">
      <SketchGrid className="pointer-events-none absolute right-0 top-8 -z-10 h-[320px] w-[440px] max-w-none opacity-[0.06]" />

      <ScreenHeading title="Scenario workspace">
        Test a change and see the effect before committing to anything — nothing here is ever saved to
        the imported snapshot. Turn on any combination of the four levers below.
      </ScreenHeading>

      {loading ? (
        <SearchlightLoader />
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Lever 1: goal */}
            <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
              <label className="flex items-center gap-2 font-pa-body text-sm font-semibold text-pa-grey-04">
                <input
                  type="checkbox"
                  data-testid="lever-goal-enabled"
                  checked={inputs.goalEnabled}
                  onChange={(e) => setInputs((prev) => ({ ...prev, goalEnabled: e.target.checked }))}
                  className="accent-pa-aqua-04"
                />
                Change the organisational goal
              </label>
              <p className="mt-1 font-pa-body text-xs text-pa-grey-03">DES-wide only — divisions/teams keep their own target as their own goal.</p>
              <input
                type="number"
                data-testid="lever-goal-value"
                disabled={!inputs.goalEnabled}
                value={inputs.goal}
                onChange={(e) => setInputs((prev) => ({ ...prev, goal: Number(e.target.value) }))}
                className={`${inputClass} mt-2 w-32 disabled:opacity-40`}
              />
              <span className="ml-2 font-pa-body text-xs text-pa-grey-03">£k (baseline: <span className="font-pa-mono">£{round1(baselineGoal)}k</span>)</span>
            </div>

            {/* Lever 2: capacity for a team/division */}
            <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
              <label className="flex items-center gap-2 font-pa-body text-sm font-semibold text-pa-grey-04">
                <input
                  type="checkbox"
                  data-testid="lever-capacity-enabled"
                  checked={inputs.capacityEnabled}
                  onChange={(e) => setInputs((prev) => ({ ...prev, capacityEnabled: e.target.checked }))}
                  className="accent-pa-aqua-04"
                />
                Change capacity for a team/division
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  data-testid="lever-capacity-level"
                  disabled={!inputs.capacityEnabled}
                  value={inputs.capacityLevel}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, capacityLevel: e.target.value as 'division' | 'team', capacityTeam: '' }))
                  }
                  className={`${selectClass} disabled:opacity-40`}
                >
                  <option value="division">Division</option>
                  <option value="team">Team</option>
                </select>
                <select
                  data-testid="lever-capacity-division"
                  disabled={!inputs.capacityEnabled}
                  value={inputs.capacityDivision}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, capacityDivision: e.target.value as Division, capacityTeam: '' }))
                  }
                  className={`${selectClass} disabled:opacity-40`}
                >
                  <option value="">Select…</option>
                  {divisions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {inputs.capacityLevel === 'team' && (
                  <select
                    data-testid="lever-capacity-team"
                    disabled={!inputs.capacityEnabled || !inputs.capacityDivision}
                    value={inputs.capacityTeam}
                    onChange={(e) => setInputs((prev) => ({ ...prev, capacityTeam: e.target.value }))}
                    className={`${selectClass} disabled:opacity-40`}
                  >
                    <option value="">Select…</option>
                    {teamsForCapacityDivision.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="number"
                  data-testid="lever-capacity-percent"
                  disabled={!inputs.capacityEnabled}
                  value={inputs.capacityPercent}
                  onChange={(e) => setInputs((prev) => ({ ...prev, capacityPercent: Number(e.target.value) }))}
                  className={`${inputClass} w-20 disabled:opacity-40`}
                />
                <span className="font-pa-body text-xs text-pa-grey-03">% capacity change</span>
              </div>
            </div>

            {/* Lever 3: population-wide target adjustment */}
            <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
              <label className="flex items-center gap-2 font-pa-body text-sm font-semibold text-pa-grey-04">
                <input
                  type="checkbox"
                  data-testid="lever-population-enabled"
                  checked={inputs.populationEnabled}
                  onChange={(e) => setInputs((prev) => ({ ...prev, populationEnabled: e.target.checked }))}
                  className="accent-pa-aqua-04"
                />
                Population-wide target adjustment
              </label>
              <p className="mt-1 font-pa-body text-xs text-pa-grey-03">Unfiltered — applies to every imported record.</p>
              <input
                type="number"
                data-testid="lever-population-percent"
                disabled={!inputs.populationEnabled}
                value={inputs.populationPercent}
                onChange={(e) => setInputs((prev) => ({ ...prev, populationPercent: Number(e.target.value) }))}
                className={`${inputClass} mt-2 w-24 disabled:opacity-40`}
              />
              <span className="ml-2 font-pa-body text-xs text-pa-grey-03">% target change</span>
            </div>

            {/* Lever 4: expected achievement / confidence override for a selected group */}
            <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
              <label className="flex items-center gap-2 font-pa-body text-sm font-semibold text-pa-grey-04">
                <input
                  type="checkbox"
                  data-testid="lever-group-enabled"
                  checked={inputs.groupEnabled}
                  onChange={(e) => setInputs((prev) => ({ ...prev, groupEnabled: e.target.checked }))}
                  className="accent-pa-aqua-04"
                />
                Override expected achievement/confidence for a group
              </label>
              <p className="mt-1 font-pa-body text-xs text-pa-grey-03">That group&apos;s own row only — never cascades to its parent.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  data-testid="lever-group-level"
                  disabled={!inputs.groupEnabled}
                  value={inputs.groupLevel}
                  onChange={(e) =>
                    setInputs((prev) => ({
                      ...prev,
                      groupLevel: e.target.value as 'desWide' | 'division' | 'team',
                      groupDivision: '',
                      groupTeam: '',
                    }))
                  }
                  className={`${selectClass} disabled:opacity-40`}
                >
                  <option value="desWide">DES-wide</option>
                  <option value="division">Division</option>
                  <option value="team">Team</option>
                </select>
                {inputs.groupLevel !== 'desWide' && (
                  <select
                    data-testid="lever-group-division"
                    disabled={!inputs.groupEnabled}
                    value={inputs.groupDivision}
                    onChange={(e) =>
                      setInputs((prev) => ({ ...prev, groupDivision: e.target.value as Division, groupTeam: '' }))
                    }
                    className={`${selectClass} disabled:opacity-40`}
                  >
                    <option value="">Select…</option>
                    {divisions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                )}
                {inputs.groupLevel === 'team' && (
                  <select
                    data-testid="lever-group-team"
                    disabled={!inputs.groupEnabled || !inputs.groupDivision}
                    value={inputs.groupTeam}
                    onChange={(e) => setInputs((prev) => ({ ...prev, groupTeam: e.target.value }))}
                    className={`${selectClass} disabled:opacity-40`}
                  >
                    <option value="">Select…</option>
                    {teamsForGroupDivision.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1 font-pa-body text-xs text-pa-grey-03">
                  <input
                    type="checkbox"
                    data-testid="lever-group-ea-enabled"
                    disabled={!inputs.groupEnabled}
                    checked={inputs.groupExpectedAchievementEnabled}
                    onChange={(e) => setInputs((prev) => ({ ...prev, groupExpectedAchievementEnabled: e.target.checked }))}
                    className="accent-pa-aqua-04"
                  />
                  Expected achievement
                  <input
                    type="number"
                    data-testid="lever-group-ea-value"
                    disabled={!inputs.groupEnabled || !inputs.groupExpectedAchievementEnabled}
                    value={inputs.groupExpectedAchievement}
                    onChange={(e) => setInputs((prev) => ({ ...prev, groupExpectedAchievement: Number(e.target.value) }))}
                    className={`${inputClass} w-24 disabled:opacity-40`}
                  />
                  £k
                </label>
                <label className="flex items-center gap-1 font-pa-body text-xs text-pa-grey-03">
                  <input
                    type="checkbox"
                    data-testid="lever-group-confidence-enabled"
                    disabled={!inputs.groupEnabled}
                    checked={inputs.groupConfidenceEnabled}
                    onChange={(e) => setInputs((prev) => ({ ...prev, groupConfidenceEnabled: e.target.checked }))}
                    className="accent-pa-aqua-04"
                  />
                  Confidence
                  <select
                    data-testid="lever-group-confidence-value"
                    disabled={!inputs.groupEnabled || !inputs.groupConfidenceEnabled}
                    value={inputs.groupConfidence}
                    onChange={(e) => setInputs((prev) => ({ ...prev, groupConfidence: e.target.value as Confidence }))}
                    className={`${selectClass} disabled:opacity-40`}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {isTweaked && (
            <button
              type="button"
              onClick={() => setInputs(defaultInputs(baselineAggregation.desWide.target))}
              className="rounded-md border border-pa-grey-02 px-3 py-1.5 font-pa-body text-sm font-medium text-pa-grey-04 hover:bg-pa-grey-01"
            >
              Reset scenario
            </button>
          )}

          <div>
            <h2 className="font-pa-display text-sm font-semibold text-pa-grey-04">DES-wide: baseline vs scenario</h2>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="font-pa-body text-xs font-semibold uppercase tracking-wide text-pa-grey-03">Baseline</div>
                <div className="grid grid-cols-2 gap-2">
                  <KpiTile label="Goal" value={`£${round1(baselineGoal)}k`} />
                  <KpiTile
                    label="Forecast"
                    value={`${round1(baselineRisk.desWide.forecastRatio * 100)}%`}
                    sub={`£${round1(baselineAggregation.desWide.expectedAchievement)}k expected`}
                  />
                </div>
                <span
                  data-testid="baseline-status"
                  data-status={baselineRisk.desWide.status}
                  className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(baselineRisk.desWide.status)}`}
                >
                  {baselineRisk.desWide.status}
                </span>
              </div>
              <div className="space-y-2 rounded-xl border border-pa-grey-02 bg-pa-grey-wash p-2">
                <div className="font-pa-body text-xs font-semibold uppercase tracking-wide text-pa-grey-03">Scenario</div>
                <div className="grid grid-cols-2 gap-2">
                  <KpiTile label="Goal" value={`£${round1(scenarioGoal)}k`} />
                  <KpiTile
                    label="Forecast"
                    value={`${round1(scenario.riskStatuses.desWide.forecastRatio * 100)}%`}
                    sub={`£${round1(scenario.aggregation.desWide.expectedAchievement)}k expected`}
                  />
                </div>
                <span
                  data-testid="scenario-status"
                  data-status={scenario.riskStatuses.desWide.status}
                  className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(scenario.riskStatuses.desWide.status)}`}
                >
                  {scenario.riskStatuses.desWide.status}
                </span>
              </div>
            </div>
          </div>

          {scopedGroupKey && baselineScopedRollup && baselineScopedRisk && scenarioScopedRollup && scenarioScopedRisk && (
            <div>
              <h2 className="font-pa-display text-sm font-semibold text-pa-grey-04">
                {scopedGroupKey.replace('::', ' / ')}: baseline vs scenario
              </h2>
              <div className="mt-2 overflow-x-auto rounded-lg border border-pa-grey-01 bg-pa-white">
                <table className="min-w-full divide-y divide-pa-grey-01 font-pa-body text-sm">
                  <thead className="bg-pa-grey-wash text-left text-xs font-medium uppercase tracking-wide text-pa-grey-03">
                    <tr>
                      <th className="px-3 py-2"></th>
                      <th className="px-3 py-2 text-right">Target</th>
                      <th className="px-3 py-2 text-right">Expected achievement</th>
                      <th className="px-3 py-2 text-right">Forecast</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-pa-grey-01" data-testid="scoped-baseline-row">
                      <td className="px-3 py-2 font-medium text-pa-grey-03">Baseline</td>
                      <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">£{round1(baselineScopedRollup.target)}k</td>
                      <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">
                        £{round1(baselineScopedRollup.expectedAchievement)}k
                      </td>
                      <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">
                        {round1(baselineScopedRisk.forecastRatio * 100)}%
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(baselineScopedRisk.status)}`}>
                          {baselineScopedRisk.status}
                        </span>
                      </td>
                    </tr>
                    <tr className="border-t border-pa-grey-01 bg-pa-grey-wash" data-testid="scoped-scenario-row">
                      <td className="px-3 py-2 font-medium text-pa-grey-03">Scenario</td>
                      <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">£{round1(scenarioScopedRollup.target)}k</td>
                      <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">
                        £{round1(scenarioScopedRollup.expectedAchievement)}k
                      </td>
                      <td className="px-3 py-2 text-right font-pa-mono tabular-nums text-pa-grey-04">
                        {round1(scenarioScopedRisk.forecastRatio * 100)}%
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(scenarioScopedRisk.status)}`}>
                          {scenarioScopedRisk.status}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
            <h2 className="font-pa-display text-sm font-semibold text-pa-grey-04">Save this scenario</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                data-testid="scenario-name-input"
                placeholder="Scenario name…"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                className={`${inputClass} w-64`}
              />
              <button
                type="button"
                data-testid="scenario-save-button"
                disabled={!isTweaked || scenarioName.trim().length === 0}
                onClick={() => {
                  saveScenario(scenarioName.trim(), levers)
                  setScenarioName('')
                }}
                className="rounded-md bg-pa-aqua-05 px-3 py-1.5 font-pa-body text-sm font-medium text-pa-white hover:bg-pa-aqua-04 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save scenario
              </button>
            </div>

            {savedScenarios.length > 0 && (
              <ul data-testid="saved-scenario-list" className="mt-4 divide-y divide-pa-grey-01 font-pa-body text-sm">
                {savedScenarios.map((s) => (
                  <li key={s.id} data-testid="saved-scenario-row" data-scenario-id={s.id} className="flex items-center justify-between py-2">
                    <span>
                      <span className="font-medium text-pa-grey-04">{s.name}</span>{' '}
                      <span className="font-pa-mono text-xs text-pa-grey-03">saved {s.savedAt}</span>
                    </span>
                    <button
                      type="button"
                      data-testid="scenario-delete-button"
                      onClick={() => deleteScenario(s.id)}
                      className="text-xs font-medium text-pa-grey-03 hover:text-pa-ingenuity-red"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
