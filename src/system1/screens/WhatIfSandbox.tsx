import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { GRADE_CODES, GRADE_TABLE, type GradeCode } from '../data/types'
import { useSystem1Store } from '../../store/system1Store'
import { calculateModelledTarget } from '../engine/targetingEngine'
import { finalTargetFor } from '../engine/finalTarget'

const CAPACITY_MIN = 0.3
const CAPACITY_MAX = 1.3
const ECONOMIC_MIN = 0.8
const ECONOMIC_MAX = 1.3

interface SandboxInputs {
  capacity: number
  gradeCode: GradeCode
  economicFactor: number
}

function inputsFromPerson(person: (typeof SEED_PEOPLE)[number]): SandboxInputs {
  return { capacity: person.capacity, gradeCode: person.gradeCode, economicFactor: person.economicFactor }
}

// M7: non-committing recalculation. Every tweak here calls the same M2
// engine function with hypothetical numbers — nothing is ever written to
// the store. There's no "Apply" here on purpose: CLAUDE.md requires a
// reason on every override with no exceptions, and that capture belongs to
// Manager override (M8), not this screen.
export function WhatIfSandbox() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const targets = useSystem1Store((state) => state.targets)

  const sortedPeople = [...SEED_PEOPLE].sort((a, b) => a.name.localeCompare(b.name))
  const person = id ? SEED_PEOPLE.find((p) => p.id === id) : undefined
  const target = person ? targets[person.id] : undefined

  const [inputs, setInputs] = useState<SandboxInputs | null>(person ? inputsFromPerson(person) : null)

  // Switching person resets the sandbox to *their* actual values — never
  // carries over the previous person's tweaked numbers. Adjusting state
  // during render (React's recommended pattern for "reset when a prop
  // changes") rather than useEffect, which would cost an extra render.
  const [resetForId, setResetForId] = useState(person?.id)
  if (person?.id !== resetForId) {
    setResetForId(person?.id)
    setInputs(person ? inputsFromPerson(person) : null)
  }

  const sandboxResult = useMemo(() => {
    if (!person || !inputs) return null
    return calculateModelledTarget({
      baseline: person.baseline,
      capacity: inputs.capacity,
      roleFactor: GRADE_TABLE[inputs.gradeCode].roleFactor,
      economicFactor: inputs.economicFactor,
    })
  }, [person, inputs])

  const isTweaked =
    person && inputs && (inputs.capacity !== person.capacity || inputs.gradeCode !== person.gradeCode || inputs.economicFactor !== person.economicFactor)

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">What-if sandbox</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Tweak inputs to see the recalculated target. Nothing here is saved — this never changes the stored
          record.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Person
        <select
          data-testid="whatif-person-select"
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
          value={person?.id ?? ''}
          onChange={(e) => navigate(`/system1/whatif/${e.target.value}`)}
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

      {person && target && inputs && sandboxResult ? (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700">
              {person.name} — {person.division}, £{person.baseline}k baseline
            </h2>

            <div className="mt-4 space-y-4">
              <label className="block">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">Capacity</span>
                  <span data-testid="whatif-capacity-value" className="font-medium tabular-nums text-slate-900">
                    {inputs.capacity.toFixed(2)}
                  </span>
                </div>
                <input
                  data-testid="whatif-capacity-slider"
                  type="range"
                  min={CAPACITY_MIN}
                  max={CAPACITY_MAX}
                  step={0.01}
                  value={inputs.capacity}
                  onChange={(e) => setInputs((prev) => (prev ? { ...prev, capacity: Number(e.target.value) } : prev))}
                  className="mt-1 w-full"
                />
              </label>

              <label className="block">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">Grade / role</span>
                  <span data-testid="whatif-grade-value" className="font-medium text-slate-900">
                    G{inputs.gradeCode} {GRADE_TABLE[inputs.gradeCode].roleTitle} ({GRADE_TABLE[inputs.gradeCode].roleFactor})
                  </span>
                </div>
                <select
                  data-testid="whatif-grade-select"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
                  value={inputs.gradeCode}
                  onChange={(e) =>
                    setInputs((prev) => (prev ? { ...prev, gradeCode: Number(e.target.value) as GradeCode } : prev))
                  }
                >
                  {GRADE_CODES.map((code) => (
                    <option key={code} value={code}>
                      G{code} {GRADE_TABLE[code].roleTitle} ({GRADE_TABLE[code].roleFactor})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">Economic factor</span>
                  <span data-testid="whatif-economic-value" className="font-medium tabular-nums text-slate-900">
                    {inputs.economicFactor.toFixed(2)}
                  </span>
                </div>
                <input
                  data-testid="whatif-economic-slider"
                  type="range"
                  min={ECONOMIC_MIN}
                  max={ECONOMIC_MAX}
                  step={0.01}
                  value={inputs.economicFactor}
                  onChange={(e) =>
                    setInputs((prev) => (prev ? { ...prev, economicFactor: Number(e.target.value) } : prev))
                  }
                  className="mt-1 w-full"
                />
              </label>
            </div>

            {isTweaked && (
              <button
                type="button"
                onClick={() => setInputs(inputsFromPerson(person))}
                className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Reset to current values
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Currently stored ({target.status})
              </div>
              <div data-testid="whatif-stored-modelled" className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                £{finalTargetFor(target)}k
              </div>
              <div className="text-xs text-slate-500">
                {target.override
                  ? `Modelled was £${target.modelled}k, range £${target.rangeLow}k – £${target.rangeHigh}k`
                  : `Range £${target.rangeLow}k – £${target.rangeHigh}k`}
              </div>
            </div>
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Sandbox result</div>
              <div data-testid="whatif-sandbox-modelled" className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                £{sandboxResult.modelled}k
              </div>
              <div data-testid="whatif-sandbox-range" className="text-xs text-slate-500">
                Range £{sandboxResult.rangeLow}k – £{sandboxResult.rangeHigh}k
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            This is a scenario only — it never changes {person.name}'s stored record. To apply a value as an
            actual override with a reason, use Manager override (coming in M8).
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">Select a person above to start a what-if scenario.</p>
      )}
    </section>
  )
}
