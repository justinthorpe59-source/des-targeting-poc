import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store, type OverrideType } from '../../store/system1Store'
import { LARGE_ADJUSTMENT_THRESHOLD } from '../engine/exceptions'
import { runOverrideCrossCheck } from '../engine/overrideCrossCheck'
import { buildIndividualSignOffContext } from '../engine/buildSignOffContext'
import { useSystem2LiveSnapshot } from '../../system2/bridge/useSystem2LiveState'
import { explainTarget } from '../engine/explainTarget'
import { CrossCheckPanel } from '../components/CrossCheckPanel'

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
export function ManagerOverride() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const targets = useSystem1Store((state) => state.targets)
  const applyOverride = useSystem1Store((state) => state.applyOverride)
  const revertOverride = useSystem1Store((state) => state.revertOverride)
  const updateNotes = useSystem1Store((state) => state.updateNotes)
  const system2Snapshot = useSystem2LiveSnapshot()

  const sortedPeople = [...SEED_PEOPLE].sort((a, b) => a.name.localeCompare(b.name))
  const person = id ? SEED_PEOPLE.find((p) => p.id === id) : undefined
  const target = person ? targets[person.id] : undefined

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

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Manager override</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Change a person's target. A reason is required — the model never blocks a change, it only flags
          outliers for your own sense-check.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Person
        <select
          data-testid="override-person-select"
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
          value={person?.id ?? ''}
          onChange={(e) => navigate(`/system1/override/${e.target.value}`)}
        >
          <option value="" disabled>
            Select a person…
          </option>
          {sortedPeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>
      </label>

      {!person || !target ? (
        <p className="text-sm text-slate-500">Select a person above to make an override.</p>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-700">{person.name}</h2>
              <span data-testid="override-status" className="text-xs font-medium text-slate-500">
                {target.status}
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Modelled target:{' '}
              <span className="font-medium tabular-nums text-slate-900">£{target.modelled}k</span> (range £
              {target.rangeLow}k – £{target.rangeHigh}k)
            </div>

            {target.status === 'Pending Sign-off' && (
              <p data-testid="override-pending-signoff-banner" className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                This change is pending sign-off from {person.division} / {person.team}&apos;s leadership group —
                it hasn&apos;t applied as final yet.{' '}
                <Link to="/system1/signoff" className="font-medium underline">
                  View the Sign-off Queue →
                </Link>
              </p>
            )}

            {target.override && (
              <div data-testid="override-current" className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-700">Current override</div>
                <div className="mt-1 text-slate-600">
                  {target.override.type === 'percent'
                    ? `${target.override.value > 0 ? '+' : ''}${target.override.value}%`
                    : `Direct value`}{' '}
                  → <span className="font-medium tabular-nums text-slate-900">£{target.override.finalValue}k</span>
                </div>
                <div className="mt-1 text-slate-500">Reason: {target.override.reason}</div>

                <div className="mt-3 flex items-end gap-2">
                  <label className="flex-1 text-xs font-medium text-slate-500">
                    Reason for reverting
                    <input
                      data-testid="revert-reason-input"
                      type="text"
                      value={revertReason}
                      onChange={(e) => setRevertReason(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      placeholder="Why are you reverting this?"
                    />
                  </label>
                  <button
                    type="button"
                    data-testid="revert-button"
                    disabled={revertReason.trim().length === 0}
                    onClick={handleRevert}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Revert to modelled
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">Explanation</h2>
            <p data-testid="override-explanation" className="mt-2 text-sm leading-relaxed text-slate-700">
              {explainTarget(person, target)}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">New override</h2>

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
                <label className="block text-xs font-medium text-slate-500">
                  Percentage change
                  <input
                    data-testid="override-percent-input"
                    type="number"
                    value={percentValue}
                    onChange={(e) => setPercentValue(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
              ) : (
                <label className="block text-xs font-medium text-slate-500">
                  Direct value (£k)
                  <input
                    data-testid="override-direct-input"
                    type="number"
                    value={directValue}
                    onChange={(e) => setDirectValue(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
              )}
            </div>

            <div className="mt-3 text-sm text-slate-600">
              Resulting target:{' '}
              <span data-testid="override-preview" className="font-semibold tabular-nums text-slate-900">
                £{previewFinal}k
              </span>{' '}
              <span className="text-xs text-slate-500">
                ({previewDeviationPct > 0 ? '+' : ''}
                {previewDeviationPct}% from modelled)
              </span>
            </div>

            {isLargeAdjustment && (
              <p data-testid="override-large-adjustment-flag" className="mt-2 text-xs text-amber-700">
                This is more than ±20% from the modelled target. Flagged for your own sense-check — it doesn't
                block applying it.
              </p>
            )}

            <label className="mt-3 block text-xs font-medium text-slate-500">
              Reason (required)
              <textarea
                data-testid="override-reason-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Why are you making this change?"
              />
            </label>

            <button
              type="button"
              data-testid="apply-override-button"
              disabled={!canSubmit}
              onClick={handleApply}
              className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {crossCheck?.requiresSignOff ? 'Apply override (routes to Pending Sign-off)' : 'Apply override'}
            </button>
          </div>

          {crossCheck && <CrossCheckPanel result={crossCheck} />}

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">Personal context</h2>
            <p className="mt-1 text-xs text-slate-500">
              Strengths, interests, goals. Informs the explanation and override reasoning — never the formula
              itself. Visible to {person.name} in their own Employee view.
            </p>
            <textarea
              data-testid="notes-input"
              value={notesDraft}
              onChange={(e) => {
                setNotesDraft(e.target.value)
                setNotesSaved(false)
              }}
              rows={3}
              className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              data-testid="save-notes-button"
              disabled={notesSaved}
              onClick={handleSaveNotes}
              className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {notesSaved ? 'Saved' : 'Save notes'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
