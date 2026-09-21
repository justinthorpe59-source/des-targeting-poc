import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SEED_PEOPLE } from '../system1/data/people'
import { calculateModelledTarget } from '../system1/engine/targetingEngine'

/**
 * System 1's shared store. Population data (src/system1/data/people.ts) is
 * static reference data, never persisted or mutated — this store only holds
 * the *stateful* part: one TargetRecord per person, keyed by id, plus a
 * shared audit log.
 */

/**
 * Batch 3b: 'Pending Sign-off' is a placeholder state — an override the
 * real-time cross-check flagged (a check failed, or it's a drastic %
 * change) lands here instead of 'Adjusted', so it's visibly not a normal
 * in-flight override. The actual sign-off approval flow (who can clear it,
 * how) is Batch 3d's job; this state only exists so a flagged change is
 * never silently treated as final in the meantime — see proposeRecord()'s
 * allow-list below, which deliberately excludes it.
 */
export type TargetStatus = 'Modelled' | 'Adjusted' | 'Proposed' | 'Approved' | 'Pending Sign-off'

export type OverrideType = 'percent' | 'direct'

export interface OverrideInfo {
  type: OverrideType
  /** The raw number the manager entered — a percentage (e.g. 10 for +10%) or a direct £k value, depending on `type`. */
  value: number
  /** The resulting £k target after applying the override — what finalTargetFor() returns once this exists. */
  finalValue: number
  /** Required, no exceptions — CLAUDE.md's own words. */
  reason: string
}

/**
 * Batch 3d: the frozen, display-ready cross-check result a record was
 * routed to 'Pending Sign-off' with — copied verbatim from 3b/3c's already-
 * computed OverrideCrossCheckResult/MassAdjustmentCrossCheckResult at the
 * moment applyOverride() ran, not recomputed later. System 2's live state
 * (and this person's other records) can keep moving after that moment, but
 * the Sign-off Queue is reviewing the specific numbers that triggered the
 * flag, not a fresh recalculation against whatever System 2 says right now.
 */
export interface SignOffCheckSummary {
  status: 'pass' | 'fail'
  detail: string
}

export interface SignOffAggregateGroup {
  key: string
  label: string
  status: 'pass' | 'fail'
  detail: string
}

export interface SignOffContext {
  source: 'individual' | 'mass'
  /** Shared by every record from the same Mass Adjustment Apply click; absent for an individual Manager Override. */
  batchId?: string
  reasons: string[]
  isDrasticChange: boolean
  team: SignOffCheckSummary | null
  cohort: SignOffCheckSummary | null
  org: SignOffCheckSummary | null
  /** Mass-adjustment only: the batch-wide team/division/org aggregate checks — the same for every person sharing this batchId. */
  aggregateGroups?: SignOffAggregateGroup[]
  /** Mass-adjustment only: how the whole batch (not just this person) broke down individually. */
  batchIndividualPassCount?: number
  batchIndividualFailCount?: number
  batchSize?: number
}

export interface TargetRecord {
  personId: string
  status: TargetStatus
  /** Computed by the M2 engine from the person's locked input factors. Never overwritten by an override — the model's original answer stays visible even after a manager changes it. */
  modelled: number
  rangeLow: number
  rangeHigh: number
  /** Freeform manager notes (strengths, interests, goals) — informs the explanation and override reasoning, never the formula itself. */
  notes: string
  /** Present only once a manager has overridden this record (M8, or M10's mass adjustment). Absent = the model's number stands. */
  override?: OverrideInfo
  /** Set by approveRecord() (M11). M13's snapshot export reads this directly rather than scanning the audit log for the latest "Approved" entry. */
  approvedAt?: string
  /** Batch 3d: present only while (or after) status is 'Pending Sign-off' — the frozen cross-check result the Sign-off Queue reviews. Cleared on reject (back to Modelled, no override left to explain), left in place on approve (historical "this was approved despite these flags" context). */
  signOffContext?: SignOffContext
}

/**
 * Full history across all records, "who, what, when, why" — Individual
 * Detail filters this by personId for its own change-history section; a
 * later Audit screen reads the whole array unfiltered.
 */
export interface ChangeLogEntry {
  id: string
  personId: string
  timestamp: string
  actor: string
  action: string
  detail: string
}

function buildSeedTargets(): Record<string, TargetRecord> {
  const targets: Record<string, TargetRecord> = {}
  for (const person of SEED_PEOPLE) {
    const { modelled, rangeLow, rangeHigh } = calculateModelledTarget({
      baseline: person.baseline,
      capacity: person.capacity,
      roleFactor: person.roleFactor,
      economicFactor: person.economicFactor,
    })
    targets[person.id] = { personId: person.id, status: 'Modelled', modelled, rangeLow, rangeHigh, notes: '' }
  }
  return targets
}

export interface ApplyOverrideInput {
  type: OverrideType
  value: number
  reason: string
  /** Distinguishes an individual manager override from a mass-adjustment batch in the audit log's action text. Defaults to 'individual'. */
  source?: 'individual' | 'mass'
  /** Batch 3b: set by the caller when the real-time cross-check determined this change needs sign-off. Routes to 'Pending Sign-off' instead of 'Adjusted' — the model still never blocks the change itself, it just doesn't let it look like a normal Adjusted record. */
  requiresSignOff?: boolean
  /** Batch 3d: required alongside requiresSignOff — the frozen cross-check result the Sign-off Queue will display. */
  signOffContext?: SignOffContext
}

interface System1State {
  targets: Record<string, TargetRecord>
  auditLog: ChangeLogEntry[]
  resetToSeed: () => void
  addAuditEntry: (entry: Omit<ChangeLogEntry, 'id' | 'timestamp'>) => void
  /**
   * The model never blocks — this always succeeds regardless of the size of
   * the change. An oversized adjustment gets flagged by the exceptions
   * detector for the manager's own sense-check, never rejected here.
   */
  applyOverride: (personId: string, input: ApplyOverrideInput) => void
  /** Clears the override and returns the record to Modelled. Proposed/Approved don't exist until M11 — nothing to preserve beyond that yet. */
  revertOverride: (personId: string, reason: string) => void
  /** Personal notes are edited on the override screen, separate from the override reason — notes describe the person, the reason describes this specific change. */
  updateNotes: (personId: string, notes: string) => void
  /**
   * M10: applies the same percent-only override to every id in the list —
   * a thin loop over applyOverride(), not a second implementation. The
   * screen is responsible for deciding which ids to pass (e.g. excluding
   * people who already have an individual override); this action doesn't
   * second-guess that list.
   *
   * Batch 3c: signOffPersonIds names which of those ids route to 'Pending
   * Sign-off' instead of 'Adjusted' — everyone in the list when the cross-
   * check's aggregate effect failed, or just the specific outliers when it
   * didn't. The screen decides which; this loop just applies it per id,
   * same division of responsibility as the id list itself.
   *
   * Batch 3d: signOffContextByPersonId supplies the frozen cross-check
   * result for each id that's routing to Pending Sign-off, same as
   * applyOverride's own signOffContext — one entry per id in
   * signOffPersonIds.
   */
  applyMassAdjustment: (
    personIds: string[],
    input: {
      percent: number
      reason: string
      signOffPersonIds?: string[]
      signOffContextByPersonId?: Record<string, SignOffContext>
    },
  ) => void
  /**
   * M11: Modelled/Adjusted -> Proposed. No-ops (safely, silently) if the
   * record is already Proposed or Approved — callers gate the button on
   * status, this is the defensive backstop. No reason required — this is a
   * procedural workflow advance, not a change to the target value (that
   * justification, if any, was already captured on the override itself).
   */
  proposeRecord: (personId: string) => void
  /** M11: Proposed -> Approved only. One-way for this POC — no revert. */
  approveRecord: (personId: string) => void
  /**
   * Batch 3d: the Sign-off Queue's Approve action. Pending Sign-off ->
   * Approved directly (skips Proposed — the leadership review this
   * represents already covers what a manager's Propose step would have),
   * per locked-spec.md. No-ops if the record isn't Pending Sign-off.
   */
  approveSignOff: (personId: string, note: string, reviewerLabel?: string) => void
  /** Loops approveSignOff() across a whole mass-adjustment batch sharing a signOffContext.batchId — same "thin loop, not a second implementation" pattern as applyMassAdjustment(). */
  approveSignOffBatch: (personIds: string[], note: string, reviewerLabel?: string) => void
  /**
   * Batch 3d: the Sign-off Queue's Reject action. Reverts to the pre-
   * override state — same mechanism as revertOverride() (this record's
   * `modelled` was never touched by the override, so "back to Modelled" is
   * the actual prior state, not an approximation of it), but logged as a
   * leadership rejection so the audit trail (and Individual Detail's change
   * history, which the original proposer can read) shows why.
   */
  rejectSignOff: (personId: string, reason: string, reviewerLabel?: string) => void
  /** Loops rejectSignOff() across a whole mass-adjustment batch. */
  rejectSignOffBatch: (personIds: string[], reason: string, reviewerLabel?: string) => void
}

export const useSystem1Store = create<System1State>()(
  persist(
    (set, get) => ({
      targets: buildSeedTargets(),
      auditLog: [],

      resetToSeed: () => set({ targets: buildSeedTargets(), auditLog: [] }),

      addAuditEntry: (entry) =>
        set((state) => ({
          auditLog: [
            ...state.auditLog,
            { ...entry, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
          ],
        })),

      applyOverride: (personId, { type, value, reason, source = 'individual', requiresSignOff = false, signOffContext }) => {
        const existing = get().targets[personId]
        if (!existing) return
        const finalValue =
          type === 'percent' ? Math.round(existing.modelled * (1 + value / 100)) : Math.round(value)

        set((state) => ({
          targets: {
            ...state.targets,
            [personId]: {
              ...existing,
              status: requiresSignOff ? 'Pending Sign-off' : 'Adjusted',
              override: { type, value, finalValue, reason },
              signOffContext: requiresSignOff ? signOffContext : undefined,
            },
          },
        }))

        get().addAuditEntry({
          personId,
          actor: 'Manager',
          action: source === 'mass' ? 'Mass adjustment applied' : 'Override applied',
          detail:
            (type === 'percent'
              ? `${value > 0 ? '+' : ''}${value}% → £${finalValue}k. Reason: ${reason}`
              : `Set to £${finalValue}k. Reason: ${reason}`) +
            (requiresSignOff ? ' [Routed to Pending Sign-off by the real-time cross-check.]' : ''),
        })
      },

      revertOverride: (personId, reason) => {
        const existing = get().targets[personId]
        if (!existing || !existing.override) return

        set((state) => {
          const current = state.targets[personId]
          const { personId: pid, modelled, rangeLow, rangeHigh, notes } = current
          return {
            targets: {
              ...state.targets,
              [personId]: { personId: pid, status: 'Modelled', modelled, rangeLow, rangeHigh, notes },
            },
          }
        })

        get().addAuditEntry({
          personId,
          actor: 'Manager',
          action: 'Override reverted',
          detail: `Back to modelled £${existing.modelled}k. Reason: ${reason}`,
        })
      },

      updateNotes: (personId, notes) =>
        set((state) => {
          const existing = state.targets[personId]
          if (!existing) return state
          return { targets: { ...state.targets, [personId]: { ...existing, notes } } }
        }),

      applyMassAdjustment: (personIds, { percent, reason, signOffPersonIds, signOffContextByPersonId }) => {
        const signOffSet = new Set(signOffPersonIds ?? [])
        for (const personId of personIds) {
          get().applyOverride(personId, {
            type: 'percent',
            value: percent,
            reason,
            source: 'mass',
            requiresSignOff: signOffSet.has(personId),
            signOffContext: signOffContextByPersonId?.[personId],
          })
        }
      },

      proposeRecord: (personId) => {
        const existing = get().targets[personId]
        // Positive allow-list, not a block-list: only Modelled/Adjusted may
        // advance. A block-list (exclude Proposed/Approved) would silently
        // let 'Pending Sign-off' slip through to 'Proposed' too, defeating
        // the whole point of routing a flagged change there.
        if (!existing || (existing.status !== 'Modelled' && existing.status !== 'Adjusted')) return

        set((state) => ({
          targets: { ...state.targets, [personId]: { ...existing, status: 'Proposed' } },
        }))

        get().addAuditEntry({
          personId,
          actor: 'Manager',
          action: 'Proposed',
          detail: `Status changed to Proposed.`,
        })
      },

      approveRecord: (personId) => {
        const existing = get().targets[personId]
        if (!existing || existing.status !== 'Proposed') return

        set((state) => ({
          targets: {
            ...state.targets,
            [personId]: { ...existing, status: 'Approved', approvedAt: new Date().toISOString() },
          },
        }))

        get().addAuditEntry({
          personId,
          actor: 'Manager',
          action: 'Approved',
          detail: `Status changed to Approved.`,
        })
      },

      approveSignOff: (personId, note, reviewerLabel = 'Team leadership') => {
        const existing = get().targets[personId]
        if (!existing || existing.status !== 'Pending Sign-off') return

        set((state) => ({
          targets: {
            ...state.targets,
            [personId]: { ...existing, status: 'Approved', approvedAt: new Date().toISOString() },
          },
        }))

        get().addAuditEntry({
          personId,
          actor: reviewerLabel,
          action: 'Sign-off approved',
          detail: note,
        })
      },

      approveSignOffBatch: (personIds, note, reviewerLabel) => {
        for (const personId of personIds) get().approveSignOff(personId, note, reviewerLabel)
      },

      rejectSignOff: (personId, reason, reviewerLabel = 'Team leadership') => {
        const existing = get().targets[personId]
        if (!existing || existing.status !== 'Pending Sign-off') return

        set((state) => {
          const current = state.targets[personId]
          const { personId: pid, modelled, rangeLow, rangeHigh, notes } = current
          return {
            targets: {
              ...state.targets,
              [personId]: { personId: pid, status: 'Modelled', modelled, rangeLow, rangeHigh, notes },
            },
          }
        })

        get().addAuditEntry({
          personId,
          actor: reviewerLabel,
          action: 'Sign-off rejected',
          detail: `Reverted to modelled £${existing.modelled}k. Reason: ${reason}`,
        })
      },

      rejectSignOffBatch: (personIds, reason, reviewerLabel) => {
        for (const personId of personIds) get().rejectSignOff(personId, reason, reviewerLabel)
      },
    }),
    { name: 'des-system1' },
  ),
)
