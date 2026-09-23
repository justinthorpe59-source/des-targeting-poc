import { GRADES, type Division, type Grade, type Person } from '../data/types'
import { combinedRevenueFor } from './revenueEngine'
import { EXTREME_VALUE_DEVIATION_THRESHOLD, LARGE_ADJUSTMENT_THRESHOLD } from './exceptions'
import { aggregate } from '../../system2/engine/aggregation'
import { assessRisk, type RiskStatus } from '../../system2/engine/riskStatus'
import { CAPACITY_UTILISATION_RANGE, TEAM_HISTORICAL_TREND_RANGE, type OrgRecord } from '../../system2/data/types'
import { mulberry32, randRange, seedFromId } from '../../system2/engine/prng'
import { getDivisionLiveState, getTeamLiveState, type System2LiveSnapshot } from '../../system2/bridge/liveOrgState'

/** Same mapping buildSnapshot.ts uses for the real export — a 1-based ladder index, so a hypothetical record's shape matches what a real snapshot record would carry. */
function gradeToSnapshotCode(grade: Grade): number {
  return GRADES.indexOf(grade) + 1
}

/**
 * Batch 3b: real-time individual-override feasibility checking, per
 * locked-spec.md. Three checks, each pass/fail plus the specific numeric
 * effect, gate whether the change requires sign-off:
 *   1. Team total   — does the team's own rollup still look sensible with
 *      this person's hypothetical new contribution folded in?
 *   2. Level-cohort norms — is the proposed value a significant outlier
 *      against others at the same grade (same like-for-like split Cohort
 *      Comparison uses — automatic here, since grade alone already
 *      determines sales-target-holder status)?
 *   3. Org goal integrity — does DES-wide forecast/coverage still hold up
 *      against the fixed current goal?
 *
 * Verification pass (checked against locked-spec.md's ripple-preview
 * requirement, separate from the three sign-off checks above): `division`
 * is a fourth, informational-only field — the same team-style rollup, one
 * level up, so Manager Override can show the division aggregate ripple
 * locked-spec.md asks for alongside the team one. It never gates sign-off
 * (the spec names exactly three checks for that) and never appears in
 * signOffReasons — display only.
 *
 * The override changes the baseline-formula target (target.modelled /
 * finalValue), not combined revenue — those are independent measures (see
 * Batch 2's Individual Detail reconciliation). To check the override
 * against System 2's revenue-driven aggregate, this applies the override's
 * own relative change to the person's actual combinedRevenue: proposed
 * revenue = combinedRevenue x (proposedFinalTarget / currentModelledTarget).
 * A +15% override reads as +15% more revenue too — confirmed with the user
 * as the intended mapping (proportional, not a direct-value substitution).
 *
 * Every hypothetical rollup here is produced by calling System 2's actual
 * aggregate()/assessRisk() over a hypothetical record set — never a second,
 * parallel computation of what those functions already do.
 */

const STATUS_SEVERITY: Record<RiskStatus, number> = { 'On track': 0, 'At risk': 1, 'Off track': 2, Infeasible: 3 }
/** Exported for Batch 3c's aggregate-batch check, which applies this same absolute (team/division) and regression-aware (org) split to whole-population rollups instead of one person's. */
export function isCompliant(status: RiskStatus): boolean {
  return STATUS_SEVERITY[status] <= 1
}
/** No regression, and doesn't land in a non-compliant state — the combined "still sensible" bar both the team and org checks use. */
export function stillSensible(before: RiskStatus | null, after: RiskStatus): boolean {
  if (!isCompliant(after)) return false
  if (before === null) return true
  return STATUS_SEVERITY[after] <= STATUS_SEVERITY[before]
}

/**
 * The same per-id deterministic derivation ingestSnapshot.ts uses for a
 * real import — called here for a person who may never have been imported,
 * so the preview isn't just plausible, it's exactly what they'd get if
 * actually imported (same id in, same values out, every time).
 */
function previewCapacityAndTrend(id: string): { capacityUtilisation: number; teamHistoricalTrend: number } {
  const rng = mulberry32(seedFromId(id))
  return {
    capacityUtilisation: Math.round(randRange(rng, ...CAPACITY_UTILISATION_RANGE) * 100) / 100,
    teamHistoricalTrend: Math.round(randRange(rng, ...TEAM_HISTORICAL_TREND_RANGE) * 100) / 100,
  }
}

/** Exported for Batch 3c, which builds one of these per affected person in a mass adjustment batch, not just one. */
export function buildHypotheticalOrgRecord(person: Person, hypotheticalTarget: number): OrgRecord {
  return {
    id: person.id,
    division: person.division,
    team: person.team,
    location: person.location,
    gradeCode: gradeToSnapshotCode(person.grade),
    roleTitle: person.grade,
    target: hypotheticalTarget,
    approvedAt: '',
    ...previewCapacityAndTrend(person.id),
  }
}

export type CheckStatus = 'pass' | 'fail'

export interface TeamCheckResult {
  status: CheckStatus
  division: Division
  team: string
  beforeHeadcount: number
  afterHeadcount: number
  beforeTotal: number
  afterTotal: number
  beforeStatus: RiskStatus | null
  afterStatus: RiskStatus
  afterCoveragePct: number
  detail: string
}

/** Display-only ripple (see the file header) — same shape as TeamCheckResult minus the team-specific fields, one level up. */
export interface DivisionCheckResult {
  status: CheckStatus
  division: Division
  beforeHeadcount: number
  afterHeadcount: number
  beforeTotal: number
  afterTotal: number
  beforeStatus: RiskStatus | null
  afterStatus: RiskStatus
  afterCoveragePct: number
  detail: string
}

export interface CohortCheckResult {
  status: CheckStatus
  grade: Grade
  peerCount: number
  cohortAverage: number | null
  proposedValue: number
  deviationPct: number | null
  detail: string
}

export interface OrgCheckResult {
  status: CheckStatus
  goal: number
  beforeTotal: number
  afterTotal: number
  beforeExpected: number
  afterExpected: number
  beforeStatus: RiskStatus
  afterStatus: RiskStatus
  detail: string
}

export interface OverrideCrossCheckResult {
  hasOrgData: boolean
  team: TeamCheckResult | null
  /** Display-only — see the file header. Never gates requiresSignOff. */
  division: DivisionCheckResult | null
  cohort: CohortCheckResult | null
  org: OrgCheckResult | null
  isDrasticChange: boolean
  percentChange: number
  requiresSignOff: boolean
  signOffReasons: string[]
}

export interface OverrideCrossCheckInput {
  person: Person
  /** The override's proposed final £k value on the baseline-formula target. */
  proposedFinalTarget: number
  /** The person's current modelled (or already-adjusted) £k target, to derive the proportional revenue translation. */
  currentModelledTarget: number
  snapshot: System2LiveSnapshot
  /** The population to draw level-cohort peers from — explicit, not read internally, same convention as detectExceptions()/computeCohortAverages() elsewhere in this codebase. Callers pass SEED_PEOPLE. */
  people: Person[]
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** The proportional target->revenue translation (see the file header) as its own function, so Batch 3c's per-person hypothetical records use the exact same mapping as this batch's, not a re-derived copy. */
export function proposedRevenueFor(person: Person, proposedFinalTarget: number, currentModelledTarget: number): number {
  const revenueMultiplier = currentModelledTarget > 0 ? proposedFinalTarget / currentModelledTarget : 1
  return Math.round(combinedRevenueFor(person) * revenueMultiplier)
}

export function runOverrideCrossCheck(input: OverrideCrossCheckInput): OverrideCrossCheckResult {
  const { person, proposedFinalTarget, currentModelledTarget, snapshot, people } = input

  // Percent-change/drastic-change is a plain comparison of the target values
  // themselves — it doesn't need System 2 data and pre-dates this batch (see
  // Manager Override's existing inline large-adjustment flag), so it's
  // computed unconditionally, before the org-data gate below. Only the three
  // numbered checks (team/cohort/org) actually need System 2's live state.
  const percentChange = currentModelledTarget > 0 ? (proposedFinalTarget - currentModelledTarget) / currentModelledTarget : 0
  const isDrasticChange = Math.abs(percentChange) > LARGE_ADJUSTMENT_THRESHOLD

  if (!snapshot.hasData || !snapshot.org) {
    return {
      hasOrgData: false,
      team: null,
      division: null,
      cohort: null,
      org: null,
      isDrasticChange,
      percentChange,
      requiresSignOff: isDrasticChange,
      signOffReasons: isDrasticChange
        ? [`Drastic percentage change: ${percentChange > 0 ? '+' : ''}${round1(percentChange * 100)}%, over the ±${LARGE_ADJUSTMENT_THRESHOLD * 100}% threshold.`]
        : [],
    }
  }

  const proposedRevenue = proposedRevenueFor(person, proposedFinalTarget, currentModelledTarget)
  const hypotheticalRecord = buildHypotheticalOrgRecord(person, proposedRevenue)

  // ---- Check 1: team total ----
  const teamBefore = getTeamLiveState(snapshot, person.division, person.team)
  const teamOtherRecords = (teamBefore?.records ?? []).filter((r) => r.id !== person.id)
  const teamAfterRecords = [...teamOtherRecords, hypotheticalRecord]
  const teamAfterRollup = aggregate(teamAfterRecords).desWide
  const teamAfterRisk = assessRisk(
    teamAfterRollup,
    teamAfterRecords,
    `${person.division}::${person.team}`,
    teamBefore?.goal ?? teamAfterRollup.target,
  )
  const teamBeforeStatus = teamBefore?.risk.status ?? null
  // Absolute, not regression-based — the spec's wording for this check is
  // "does it still add up sensibly", not a transition condition (that's
  // check 3's explicit "push from on-track into worse" wording below). A
  // team moving On track -> At risk is still a pass here; only landing in
  // Off track/Infeasible fails it.
  const teamPasses = isCompliant(teamAfterRisk.status)
  const team: TeamCheckResult = {
    status: teamPasses ? 'pass' : 'fail',
    division: person.division,
    team: person.team,
    beforeHeadcount: teamBefore?.rollup.headcount ?? 0,
    afterHeadcount: teamAfterRollup.headcount,
    beforeTotal: teamBefore?.rollup.target ?? 0,
    afterTotal: teamAfterRollup.target,
    beforeStatus: teamBeforeStatus,
    afterStatus: teamAfterRisk.status,
    afterCoveragePct: round1(teamAfterRisk.forecastRatio * 100),
    detail:
      teamBeforeStatus && !isCompliant(teamBeforeStatus)
        ? `Team total moves from £${teamBefore?.rollup.target ?? 0}k to £${teamAfterRollup.target}k — team remains ${teamAfterRisk.status} (already non-compliant before this change).`
        : `Team total moves from £${teamBefore?.rollup.target ?? 0}k to £${teamAfterRollup.target}k, ${round1(teamAfterRisk.forecastRatio * 100)}% coverage — ${teamBeforeStatus ?? 'no prior data'} → ${teamAfterRisk.status}.`,
  }

  // ---- Division ripple (display-only, see file header) ----
  const divisionBefore = getDivisionLiveState(snapshot, person.division)
  const divisionOtherRecords = (divisionBefore?.records ?? []).filter((r) => r.id !== person.id)
  const divisionAfterRecords = [...divisionOtherRecords, hypotheticalRecord]
  const divisionAfterRollup = aggregate(divisionAfterRecords).desWide
  const divisionAfterRisk = assessRisk(
    divisionAfterRollup,
    divisionAfterRecords,
    person.division,
    divisionBefore?.goal ?? divisionAfterRollup.target,
  )
  const divisionBeforeStatus = divisionBefore?.risk.status ?? null
  const divisionPasses = isCompliant(divisionAfterRisk.status)
  const division: DivisionCheckResult = {
    status: divisionPasses ? 'pass' : 'fail',
    division: person.division,
    beforeHeadcount: divisionBefore?.rollup.headcount ?? 0,
    afterHeadcount: divisionAfterRollup.headcount,
    beforeTotal: divisionBefore?.rollup.target ?? 0,
    afterTotal: divisionAfterRollup.target,
    beforeStatus: divisionBeforeStatus,
    afterStatus: divisionAfterRisk.status,
    afterCoveragePct: round1(divisionAfterRisk.forecastRatio * 100),
    detail:
      divisionBeforeStatus === divisionAfterRisk.status
        ? `Division total stays £${divisionBefore?.rollup.target ?? 0}k → £${divisionAfterRollup.target}k, still ${divisionAfterRisk.status}.`
        : `Division total moves £${divisionBefore?.rollup.target ?? 0}k → £${divisionAfterRollup.target}k — ${divisionBeforeStatus ?? 'no prior data'} → ${divisionAfterRisk.status}.`,
  }

  // ---- Check 2: level-cohort norms ----
  const cohortPeers = people.filter((p) => p.grade === person.grade && p.id !== person.id)
  const cohortRevenues = cohortPeers.map((p) => combinedRevenueFor(p))
  const cohortAverage = cohortRevenues.length > 0 ? cohortRevenues.reduce((a, b) => a + b, 0) / cohortRevenues.length : null
  const deviationPct = cohortAverage !== null && cohortAverage > 0 ? Math.abs(proposedRevenue - cohortAverage) / cohortAverage : null
  const cohortPasses = deviationPct === null || deviationPct <= EXTREME_VALUE_DEVIATION_THRESHOLD
  const cohort: CohortCheckResult = {
    status: cohortPasses ? 'pass' : 'fail',
    grade: person.grade,
    peerCount: cohortPeers.length,
    cohortAverage: cohortAverage === null ? null : Math.round(cohortAverage),
    proposedValue: proposedRevenue,
    deviationPct: deviationPct === null ? null : round1(deviationPct * 100),
    detail:
      cohortAverage === null
        ? `No other ${person.grade} records to compare against — nothing to check.`
        : `Proposed revenue £${proposedRevenue}k is ${round1(deviationPct! * 100)}% ${proposedRevenue >= cohortAverage ? 'above' : 'below'} the ${person.grade} cohort average of £${Math.round(cohortAverage)}k (${cohortPeers.length} peer${cohortPeers.length === 1 ? '' : 's'}).`,
  }

  // ---- Check 3: org goal integrity ----
  const orgOtherRecords = snapshot.records.filter((r) => r.id !== person.id)
  const orgAfterRecords = [...orgOtherRecords, hypotheticalRecord]
  const orgAfterRollup = aggregate(orgAfterRecords).desWide
  const goal = snapshot.org.goal
  const orgAfterRisk = assessRisk(orgAfterRollup, orgAfterRecords, 'DES-wide', goal)
  const orgBeforeStatus = snapshot.org.risk.status
  const orgPasses = stillSensible(orgBeforeStatus, orgAfterRisk.status)
  const org: OrgCheckResult = {
    status: orgPasses ? 'pass' : 'fail',
    goal,
    beforeTotal: snapshot.org.rollup.target,
    afterTotal: orgAfterRollup.target,
    beforeExpected: round1(snapshot.org.rollup.expectedAchievement),
    afterExpected: round1(orgAfterRollup.expectedAchievement),
    beforeStatus: orgBeforeStatus,
    afterStatus: orgAfterRisk.status,
    detail:
      orgBeforeStatus === orgAfterRisk.status
        ? `Org forecast stays ${orgAfterRisk.status} against the £${goal}k goal (£${round1(orgAfterRollup.expectedAchievement)}k expected achievement).`
        : `Org forecast moves from ${orgBeforeStatus} to ${orgAfterRisk.status} against the £${goal}k goal (£${round1(snapshot.org.rollup.expectedAchievement)}k → £${round1(orgAfterRollup.expectedAchievement)}k expected achievement).`,
  }

  const signOffReasons: string[] = []
  if (team.status === 'fail') signOffReasons.push(`Team total check failed: ${team.detail}`)
  if (cohort.status === 'fail') signOffReasons.push(`Level-cohort norm check failed: ${cohort.detail}`)
  if (org.status === 'fail') signOffReasons.push(`Org goal integrity check failed: ${org.detail}`)
  if (isDrasticChange) {
    signOffReasons.push(
      `Drastic percentage change: ${percentChange > 0 ? '+' : ''}${round1(percentChange * 100)}%, over the ±${LARGE_ADJUSTMENT_THRESHOLD * 100}% threshold.`,
    )
  }

  return {
    hasOrgData: true,
    team,
    division,
    cohort,
    org,
    isDrasticChange,
    percentChange,
    requiresSignOff: signOffReasons.length > 0,
    signOffReasons,
  }
}
