import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { GRADES, GRADE_TABLE, type Grade, type Person } from '../data/types'
import { useSystem1Store, type OverrideType, type TargetRecord } from '../../store/system1Store'
import { calculateModelledTarget } from '../engine/targetingEngine'
import { LARGE_ADJUSTMENT_THRESHOLD } from '../engine/exceptions'
import { runOverrideCrossCheck } from '../engine/overrideCrossCheck'
import { buildIndividualSignOffContext } from '../engine/buildSignOffContext'
import { useSystem2LiveSnapshot } from '../../system2/bridge/useSystem2LiveState'
import { explainTarget } from '../engine/explainTarget'
import { CrossCheckPanel } from '../components/CrossCheckPanel'

const CAPACITY_MIN = 0.3
const CAPACITY_MAX = 1.3
const ECONOMIC_MIN = 0.8
const ECONOMIC_MAX = 1.3

interface SandboxInputs {
  capacity: number
  grade: Grade
  economicFactor: number
}

/**
 * Former WhatIfSandbox.tsx (M7), folded in here as the consolidation plan
 * requires. The override form above already previews the FINAL value live;
 * what only the sandbox could do was recalculate the MODELLED target from
 * the factors themselves. That is what moves here.
 *
 * It calls the same M2 engine function, calculateModelledTarget(), with
 * hypothetical inputs and writes nothing to the store — identical to the
 * standalone screen. The one thing the merge adds over a bolted-on copy:
 * "Use as direct value" pushes the sandbox result into the override form,
 * so exploring a factor change and committing it with a reason is now one
 * flow rather than two screens.
 */
function FactorSandbox({
  person,
  storedFinal,
  onUseValue,
}: {
  person: (typeof SEED_PEOPLE)[number]
  storedFinal: number
  onUseValue: (value: number) => void
}) {
  const initial: SandboxInputs = {
    capacity: person.capacity,
    grade: person.grade,
    economicFactor: person.economicFactor,
  }
  const [open, setOpen] = useState(false)
  const [inputs, setInputs] = useState<SandboxInputs>(initial)

  // Switching person resets to *their* actual values (render-time adjustment).
  const [forId, setForId] = useState(person.id)
  if (person.id !== forId) {
    setForId(person.id)
    setInputs({ capacity: person.capacity, grade: person.grade, economicFactor: person.economicFactor })
  }

  const result = useMemo(
    () =>
      calculateModelledTarget({
        baseline: person.baseline,
        capacity: inputs.capacity,
        roleFactor: GRADE_TABLE[inputs.grade].roleFactor,
        economicFactor: inputs.economicFactor,
      }),
    [person.baseline, inputs],
  )

  const isTweaked =
    inputs.capacity !== person.capacity ||
    inputs.grade !== person.grade ||
    inputs.economicFactor !== person.economicFactor
  const delta = result.modelled - storedFinal

  return (
    <div className="rounded-pa-card border border-pa-grey-01 bg-white p-4">
      <button
        type="button"
        data-testid="whatif-toggle"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-baseline justify-between text-left"
      >
        <span className="text-sm font-semibold text-pa-grey-04">What-if — recalculate from the factors</span>
        <span className="text-xs text-pa-grey-03">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-pa-grey-03">
            Scenario only — never changes {person.name}&apos;s stored record. Use it to see what the model would
            produce under different factors, then commit a value below with a reason.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-pa-grey-03">
              Capacity <span className="font-mono text-pa-grey-04">{inputs.capacity.toFixed(2)}</span>
              <input
                data-testid="whatif-capacity-slider"
                type="range"
                min={CAPACITY_MIN}
                max={CAPACITY_MAX}
                step={0.01}
                value={inputs.capacity}
                onChange={(e) => setInputs((prev) => ({ ...prev, capacity: Number(e.target.value) }))}
                className="mt-1 w-full"
              />
              <span data-testid="whatif-capacity-value" className="sr-only">
                {inputs.capacity.toFixed(2)}
              </span>
            </label>

            <label className="block text-xs font-medium text-pa-grey-03">
              Economic factor <span className="font-mono text-pa-grey-04">{inputs.economicFactor.toFixed(2)}</span>
              <input
                data-testid="whatif-economic-slider"
                type="range"
                min={ECONOMIC_MIN}
                max={ECONOMIC_MAX}
                step={0.01}
                value={inputs.economicFactor}
                onChange={(e) => setInputs((prev) => ({ ...prev, economicFactor: Number(e.target.value) }))}
                className="mt-1 w-full"
              />
              <span data-testid="whatif-economic-value" className="sr-only">
                {inputs.economicFactor.toFixed(2)}
              </span>
            </label>

            <label className="block text-xs font-medium text-pa-grey-03">
              Grade / role
              <select
                data-testid="whatif-grade-select"
                value={inputs.grade}
                onChange={(e) => setInputs((prev) => ({ ...prev, grade: e.target.value as Grade }))}
                className="mt-1 w-full rounded-pa-chip border border-pa-grey-02 px-2 py-1.5 text-sm"
              >
                {GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade} ({GRADE_TABLE[grade].roleFactor})
                  </option>
                ))}
              </select>
              <span data-testid="whatif-grade-value" className="sr-only">
                {inputs.grade} ({GRADE_TABLE[inputs.grade].roleFactor})
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-pa-chip bg-pa-grey-wash p-3 text-sm">
            <span className="text-pa-grey-03">
              Sandbox target:{' '}
              <span data-testid="whatif-sandbox-modelled" className="font-semibold tabular-nums text-pa-grey-04">
                £{result.modelled}k
              </span>{' '}
              <span data-testid="whatif-sandbox-range" className="text-xs text-pa-grey-03">
                (£{result.rangeLow}k – £{result.rangeHigh}k)
              </span>
            </span>
            <span className="text-xs text-pa-grey-03">
              stored{' '}
              <span data-testid="whatif-stored-modelled" className="font-mono">
                £{storedFinal}k
              </span>
              {isTweaked && (
                <>
                  {' '}
                  · {delta > 0 ? '+' : ''}
                  {delta}k vs stored
                </>
              )}
            </span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                data-testid="whatif-use-value-button"
                onClick={() => onUseValue(result.modelled)}
                className="rounded-pa-chip border border-pa-grey-02 px-2 py-1 text-xs font-medium text-pa-grey-03 hover:bg-pa-grey-01"
              >
                Use as direct value
              </button>
              {isTweaked && (
                <button
                  type="button"
                  data-testid="whatif-reset-button"
                  onClick={() => setInputs({ capacity: person.capacity, grade: person.grade, economicFactor: person.economicFactor })}
                  className="rounded-pa-chip border border-pa-grey-02 px-2 py-1 text-xs font-medium text-pa-grey-03 hover:bg-pa-grey-01"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// M8: manager override. Either a % adjustment or a direct value — manager's
// choice, both produce one final £k number. Reason required, no exceptions.
// The model never blocks: a >20% change shows an inline flag for the
// manager's own sense-check, but the Apply button stays enabled regardless.
//
// Batch 3b: real-time cross-check against System 2's live aggregate state
// (team total, level-cohort norms, org goal integrity) — recomputed on
// every keystroke via runOverrideCrossCheck(). A failing check or a drastic
// change still doesn't block Apply (same "never blocks" ethos), but routes
// the record to 'Pending Sign-off' instead of 'Adjusted' so it's never
// silently treated as final.
export function ManagerOverrideModal({
  person,
  target,
  onClose,
}: {
  person: Person
  target: TargetRecord
  onClose: () => void
}) {
  const applyOverride = useSystem1Store((state) => state.applyOverride)
  const revertOverride = useSystem1Store((state) => state.revertOverride)
  const updateNotes = useSystem1Store((state) => state.updateNotes)
  const system2Snapshot = useSystem2LiveSnapshot()

  const [overrideType, setOverrideType] = useState<OverrideType>('percent')
  const [percentValue, setPercentValue] = useState(0)
  const [directValue, setDirectValue] = useState(target?.modelled ?? 0)
  const [reason, setReason] = useState('')
  const [notesDraft, setNotesDraft] = useState(target?.notes ?? '')
  const [notesSaved, setNotesSaved] = useState(true)
  const [revertReason, setRevertReason] = useState('')

  // Reset local form state when switching person (render-time adjustment,
  // same pattern as the What-if sandbox's person switch).
  const [formForId, setFormForId] = useState(person?.id)
  if (person?.id !== formForId) {
    setFormForId(person?.id)
    setOverrideType('percent')
    setPercentValue(0)
    setDirectValue(target?.modelled ?? 0)
    setReason('')
    setNotesDraft(target?.notes ?? '')
    setNotesSaved(true)
    setRevertReason('')
  }

  const previewFinal =
    target && overrideType === 'percent'
      ? Math.round(target.modelled * (1 + percentValue / 100))
      : Math.round(directValue)
  const previewDeviationPct = target ? Math.round(((previewFinal - target.modelled) / target.modelled) * 100) : 0
  const isLargeAdjustment = Math.abs(previewDeviationPct) > LARGE_ADJUSTMENT_THRESHOLD * 100
  const canSubmit = reason.trim().length > 0

  const crossCheck = useMemo(() => {
    if (!person || !target) return null
    return runOverrideCrossCheck({
      person,
      proposedFinalTarget: previewFinal,
      currentModelledTarget: target.modelled,
      snapshot: system2Snapshot,
      people: SEED_PEOPLE,
    })
  }, [person, target, previewFinal, system2Snapshot])

  function handleApply() {
    if (!person || !canSubmit) return
    const requiresSignOff = crossCheck?.requiresSignOff ?? false
    applyOverride(person.id, {
      type: overrideType,
      value: overrideType === 'percent' ? percentValue : directValue,
      reason: reason.trim(),
      requiresSignOff,
      signOffContext: requiresSignOff && crossCheck ? buildIndividualSignOffContext(crossCheck) : undefined,
    })
    setReason('')
  }

  function handleRevert() {
    if (!person || revertReason.trim().length === 0) return
    revertOverride(person.id, revertReason.trim())
    setRevertReason('')
  }

  function handleSaveNotes() {
    if (!person) return
    updateNotes(person.id, notesDraft)
    setNotesSaved(true)
  }

  // Escape closes, and the body is locked while the modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6 font-pa-body"
      style={{ background: 'rgba(0, 23, 45, 0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="override-modal-title"
        data-testid="override-modal"
        className="my-8 w-full max-w-3xl overflow-hidden rounded-pa-card bg-pa-white shadow-[0_24px_64px_rgba(2,77,120,0.24)]"
      >
        <div className="flex items-start justify-between gap-6 border-b border-pa-grey-01 px-8 py-6">
          <div>
            <h2 id="override-modal-title" className="font-pa-display text-2xl font-semibold text-pa-grey-04">
              Manager override
            </h2>
            <p className="mt-1 font-pa-body text-sm text-pa-grey-03">
              {person.name} · {person.id} · {person.division} / {person.team}
            </p>
          </div>
          <button
            type="button"
            data-testid="override-modal-close"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pa-grey-01 font-pa-body text-lg leading-none text-pa-grey-04 transition-colors hover:bg-pa-grey-02/60"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 px-8 py-7">
          <div className="rounded-pa-card border border-pa-grey-01 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-pa-grey-04">{person.name}</h2>
              <span data-testid="override-status" className="text-xs font-medium text-pa-grey-03">
                {target.status}
              </span>
            </div>
            <div className="mt-1 text-sm text-pa-grey-03">
              Modelled target:{' '}
              <span className="font-medium tabular-nums text-pa-grey-04">£{target.modelled}k</span> (range £
              {target.rangeLow}k – £{target.rangeHigh}k)
            </div>

            {target.status === 'Pending Sign-off' && (
              <p data-testid="override-pending-signoff-banner" className="mt-3 rounded-pa-chip bg-pa-apricot-01 p-3 text-xs text-pa-grey-04">
                This change is pending sign-off from {person.division} / {person.team}&apos;s leadership group —
                it hasn&apos;t applied as final yet.{' '}
                <Link to="/system1/exceptions" className="font-medium underline">
                  View the Sign-off Queue →
                </Link>
              </p>
            )}

            {target.override && (
              <div data-testid="override-current" className="mt-3 rounded-pa-chip bg-pa-grey-wash p-3 text-sm">
                <div className="font-medium text-pa-grey-04">Current override</div>
                <div className="mt-1 text-pa-grey-03">
                  {target.override.type === 'percent'
                    ? `${target.override.value > 0 ? '+' : ''}${target.override.value}%`
                    : `Direct value`}{' '}
                  → <span className="font-medium tabular-nums text-pa-grey-04">£{target.override.finalValue}k</span>
                </div>
                <div className="mt-1 text-pa-grey-03">Reason: {target.override.reason}</div>

                <div className="mt-3 flex items-end gap-2">
                  <label className="flex-1 text-xs font-medium text-pa-grey-03">
                    Reason for reverting
                    <input
                      data-testid="revert-reason-input"
                      type="text"
                      value={revertReason}
                      onChange={(e) => setRevertReason(e.target.value)}
                      className="mt-1 w-full rounded-pa-chip border border-pa-grey-02 px-2 py-1.5 text-sm"
                      placeholder="Why are you reverting this?"
                    />
                  </label>
                  <button
                    type="button"
                    data-testid="revert-button"
                    disabled={revertReason.trim().length === 0}
                    onClick={handleRevert}
                    className="rounded-pa-chip border border-pa-grey-02 px-3 py-1.5 text-sm font-medium text-pa-grey-03 hover:bg-pa-grey-01 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Revert to modelled
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-pa-card border border-pa-grey-01 bg-white p-4">
            <h2 className="text-sm font-semibold text-pa-grey-04">Explanation</h2>
            <p data-testid="override-explanation" className="mt-2 text-sm leading-relaxed text-pa-grey-04">
              {explainTarget(person, target)}
            </p>
          </div>

          <div className="rounded-pa-card border border-pa-grey-01 bg-white p-4">
            <h2 className="text-sm font-semibold text-pa-grey-04">New override</h2>

            <div className="mt-3 flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="override-type"
                  checked={overrideType === 'percent'}
                  onChange={() => setOverrideType('percent')}
                />
                % adjustment
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="override-type"
                  checked={overrideType === 'direct'}
                  onChange={() => setOverrideType('direct')}
                />
                Direct value
              </label>
            </div>

            <div className="mt-3">
              {overrideType === 'percent' ? (
                <label className="block text-xs font-medium text-pa-grey-03">
                  Percentage change
                  <input
                    data-testid="override-percent-input"
                    type="number"
                    value={percentValue}
                    onChange={(e) => setPercentValue(Number(e.target.value))}
                    className="mt-1 w-full rounded-pa-chip border border-pa-grey-02 px-2 py-1.5 text-sm"
                  />
                </label>
              ) : (
                <label className="block text-xs font-medium text-pa-grey-03">
                  Direct value (£k)
                  <input
                    data-testid="override-direct-input"
                    type="number"
                    value={directValue}
                    onChange={(e) => setDirectValue(Number(e.target.value))}
                    className="mt-1 w-full rounded-pa-chip border border-pa-grey-02 px-2 py-1.5 text-sm"
                  />
                </label>
              )}
            </div>

            <div className="mt-3 text-sm text-pa-grey-03">
              Resulting target:{' '}
              <span data-testid="override-preview" className="font-semibold tabular-nums text-pa-grey-04">
                £{previewFinal}k
              </span>{' '}
              <span className="text-xs text-pa-grey-03">
                ({previewDeviationPct > 0 ? '+' : ''}
                {previewDeviationPct}% from modelled)
              </span>
            </div>

            {isLargeAdjustment && (
              <p data-testid="override-large-adjustment-flag" className="mt-2 text-xs text-pa-grey-04">
                This is more than ±20% from the modelled target. Flagged for your own sense-check — it doesn't
                block applying it.
              </p>
            )}

            <label className="mt-3 block text-xs font-medium text-pa-grey-03">
              Reason (required)
              <textarea
                data-testid="override-reason-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-pa-chip border border-pa-grey-02 px-2 py-1.5 text-sm"
                placeholder="Why are you making this change?"
              />
            </label>

            {/*
              The sign-off gate. Deliberately NOT a greyed-out control: the
              model never blocks a manager, so the action stays fully
              enabled — what changes is that it routes to leadership instead
              of applying immediately. The amber "at risk" colour plus
              explanatory copy carries that distinction, saying why sign-off
              is needed and who gives it, rather than leaving a dead button
              and no reason.
            */}
            {crossCheck?.requiresSignOff && (
              <div
                data-testid="override-signoff-gate"
                className="mt-4 rounded-pa-card p-4"
                style={{ background: 'var(--color-pa-apricot-01)' }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 font-pa-body text-[11px] font-semibold"
                    style={{
                      background: 'var(--color-pa-state-pending-signoff)',
                      color: 'var(--color-pa-dark-blue)',
                    }}
                  >
                    Needs sign-off
                  </span>
                  <span className="font-pa-body text-sm font-semibold text-pa-grey-04">
                    This won&apos;t apply straight away.
                  </span>
                </div>

                <p className="mt-2 font-pa-body text-sm text-pa-grey-04">
                  It goes to the{' '}
                  <span className="font-semibold">
                    {person.division} / {person.team}
                  </span>{' '}
                  leadership group to approve or reject. Nothing is blocked — you can still submit it.
                </p>

                {crossCheck.signOffReasons.length > 0 && (
                  <ul
                    data-testid="override-signoff-reasons"
                    className="mt-2 list-disc space-y-0.5 pl-5 font-pa-body text-xs text-pa-grey-04"
                  >
                    {crossCheck.signOffReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              type="button"
              data-testid="apply-override-button"
              disabled={!canSubmit}
              onClick={handleApply}
              className={`mt-4 rounded-full px-5 py-2.5 font-pa-body text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                crossCheck?.requiresSignOff
                  ? 'text-pa-dark-blue'
                  : 'bg-pa-aqua-05 text-pa-white hover:bg-pa-aqua-04'
              }`}
              style={
                crossCheck?.requiresSignOff ? { background: 'var(--color-pa-state-pending-signoff)' } : undefined
              }
            >
              {crossCheck?.requiresSignOff ? 'Send for sign-off' : 'Apply override'}
            </button>
          </div>

          <FactorSandbox
            person={person}
            storedFinal={target.override ? target.override.finalValue : target.modelled}
            onUseValue={(value) => {
              setOverrideType('direct')
              setDirectValue(value)
            }}
          />

          {crossCheck && <CrossCheckPanel result={crossCheck} />}

          {/* id="notes" is the anchor the roster card's "Notes" button targets,
              so that button lands on the manager-notes field rather than the
              top of the override screen. */}
          <div id="notes" className="scroll-mt-6 rounded-pa-card border border-pa-grey-01 bg-white p-4">
            <h2 className="text-sm font-semibold text-pa-grey-04">Personal context</h2>
            <p className="mt-1 text-xs text-pa-grey-03">
              Strengths, interests, goals. Informs the explanation and override reasoning — never the formula
              itself. Write these knowing {person.name} is entitled to read them — transparency by design.
            </p>
            <textarea
              data-testid="notes-input"
              value={notesDraft}
              onChange={(e) => {
                setNotesDraft(e.target.value)
                setNotesSaved(false)
              }}
              rows={3}
              className="mt-2 w-full rounded-pa-chip border border-pa-grey-02 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              data-testid="save-notes-button"
              disabled={notesSaved}
              onClick={handleSaveNotes}
              className="mt-2 rounded-pa-chip border border-pa-grey-02 px-3 py-1.5 text-sm font-medium text-pa-grey-03 hover:bg-pa-grey-01 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {notesSaved ? 'Saved' : 'Save notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
