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
  /** Present only once a manager has overridden this record (M8). Absent = the model's number stands. */
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
  /** Personal notes are edited here (M8), separate from the override reason — notes describe the person, the reason describes this specific change. */
  updateNotes: (personId: string, notes: string) => void
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

      applyOverride: (personId, { type, value, reason }) => {
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
          action: 'Override applied',
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
    }),
    { name: 'des-system1' },
  ),
)
