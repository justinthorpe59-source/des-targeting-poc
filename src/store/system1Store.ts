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

export type TargetStatus = 'Modelled' | 'Adjusted' | 'Proposed' | 'Approved'

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
   */
  applyMassAdjustment: (personIds: string[], input: { percent: number; reason: string }) => void
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

      applyOverride: (personId, { type, value, reason, source = 'individual' }) => {
        const existing = get().targets[personId]
        if (!existing) return
        const finalValue =
          type === 'percent' ? Math.round(existing.modelled * (1 + value / 100)) : Math.round(value)

        set((state) => ({
          targets: {
            ...state.targets,
            [personId]: {
              ...existing,
              status: 'Adjusted',
              override: { type, value, finalValue, reason },
            },
          },
        }))

        get().addAuditEntry({
          personId,
          actor: 'Manager',
          action: source === 'mass' ? 'Mass adjustment applied' : 'Override applied',
          detail:
            type === 'percent'
              ? `${value > 0 ? '+' : ''}${value}% → £${finalValue}k. Reason: ${reason}`
              : `Set to £${finalValue}k. Reason: ${reason}`,
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

      applyMassAdjustment: (personIds, { percent, reason }) => {
        for (const personId of personIds) {
          get().applyOverride(personId, { type: 'percent', value: percent, reason, source: 'mass' })
        }
      },

      proposeRecord: (personId) => {
        const existing = get().targets[personId]
        if (!existing || existing.status === 'Proposed' || existing.status === 'Approved') return

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
          targets: { ...state.targets, [personId]: { ...existing, status: 'Approved' } },
        }))

        get().addAuditEntry({
          personId,
          actor: 'Manager',
          action: 'Approved',
          detail: `Status changed to Approved.`,
        })
      },
    }),
    { name: 'des-system1' },
  ),
)
