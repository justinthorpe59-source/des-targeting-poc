import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { GRADES, GRADE_TABLE, type Grade } from '../data/types'
import { useSystem1Store } from '../../store/system1Store'
import { calculateModelledTarget } from '../engine/targetingEngine'
import { finalTargetFor } from '../engine/finalTarget'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchGrid } from '../../components/searchlight/SketchIllustrations'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'

const CAPACITY_MIN = 0.3
const CAPACITY_MAX = 1.3
const ECONOMIC_MIN = 0.8
const ECONOMIC_MAX = 1.3

interface SandboxInputs {
  capacity: number
  grade: Grade
  economicFactor: number
}

function inputsFromPerson(person: (typeof SEED_PEOPLE)[number]): SandboxInputs {
  return { capacity: person.capacity, grade: person.grade, economicFactor: person.economicFactor }
}

function AdjusterPanel({ title, valueDisplay, children }: { title: string; valueDisplay: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-pa-body text-xs font-semibold uppercase tracking-wide text-pa-grey-03">{title}</span>
        <span className="font-pa-mono text-sm font-bold text-pa-grey-04">{valueDisplay}</span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

// M7: non-committing recalculation. Every tweak calls the same M2 engine
// function with hypothetical numbers — nothing is ever written to the store,
// and there's no "Apply" (a reason-carrying override belongs to Manager
// override). Searchlight design pass: reference-led layout — a central live
// result figure with the factor adjusters flanking it.
export function WhatIfSandbox() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const targets = useSystem1Store((state) => state.targets)
  const loading = useInitialLoad(true)

  const sortedPeople = [...SEED_PEOPLE].sort((a, b) => a.name.localeCompare(b.name))
  const person = id ? SEED_PEOPLE.find((p) => p.id === id) : undefined
  const target = person ? targets[person.id] : undefined

  const [inputs, setInputs] = useState<SandboxInputs | null>(person ? inputsFromPerson(person) : null)

  // Switching person resets the sandbox to *their* actual values — adjusting
  // state during render (React's reset-on-prop-change pattern).
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
      roleFactor: GRADE_TABLE[inputs.grade].roleFactor,
      economicFactor: inputs.economicFactor,
    })
  }, [person, inputs])

  const isTweaked =
    person &&
    inputs &&
    (inputs.capacity !== person.capacity || inputs.grade !== person.grade || inputs.economicFactor !== person.economicFactor)

  const storedFinal = target ? finalTargetFor(target) : 0
  const delta = sandboxResult ? sandboxResult.modelled - storedFinal : 0

  return (
    <section className="relative space-y-6">
      <SketchGrid className="pointer-events-none absolute right-0 top-6 -z-10 h-[320px] w-[440px] max-w-none opacity-[0.05]" />

      <div>
        <h1 className="font-pa-display text-3xl font-semibold leading-tight text-pa-grey-04">What-if sandbox</h1>
        <p className="mt-1 max-w-xl font-pa-body text-sm text-pa-grey-03">
          Tweak the factors around the centre and watch the target recalculate live. Nothing here is saved — it
          never changes the stored record.
        </p>
      </div>

      <label className="flex flex-col gap-1 font-pa-body text-xs font-medium text-pa-grey-03">
        Person
        <select
          data-testid="whatif-person-select"
          className="max-w-sm rounded-md border border-pa-grey-02 bg-pa-white px-2 py-1.5 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-03"
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

      {loading ? (
        <SearchlightLoader />
      ) : person && target && inputs && sandboxResult ? (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-4">
          <div className="font-pa-body text-sm text-pa-grey-04">
            <span className="font-medium">{person.name}</span> — {person.division} ·{' '}
            <span className="font-pa-mono">£{person.baseline}k</span> baseline
          </div>

          <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)]">
            {/* Left adjusters */}
            <div className="flex flex-col gap-4">
              <AdjusterPanel title="Capacity" valueDisplay={inputs.capacity.toFixed(2)}>
                <input
                  data-testid="whatif-capacity-slider"
                  type="range"
                  min={CAPACITY_MIN}
                  max={CAPACITY_MAX}
                  step={0.01}
                  value={inputs.capacity}
                  onChange={(e) => setInputs((prev) => (prev ? { ...prev, capacity: Number(e.target.value) } : prev))}
                  className="w-full accent-pa-aqua-04"
                />
                <span data-testid="whatif-capacity-value" className="sr-only">
                  {inputs.capacity.toFixed(2)}
                </span>
              </AdjusterPanel>

              <AdjusterPanel title="Economic factor" valueDisplay={inputs.economicFactor.toFixed(2)}>
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
                  className="w-full accent-pa-aqua-04"
                />
                <span data-testid="whatif-economic-value" className="sr-only">
                  {inputs.economicFactor.toFixed(2)}
                </span>
              </AdjusterPanel>
            </div>

            {/* Central live figure */}
            <div className="mx-auto flex aspect-square w-[240px] flex-col items-center justify-center rounded-full border-2 border-pa-aqua-02 bg-pa-white text-center shadow-[0_2px_12px_rgba(2,77,120,0.07)]">
              <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
                Sandbox target
              </div>
              <div data-testid="whatif-sandbox-modelled" className="font-pa-mono text-4xl font-bold text-pa-grey-04">
                £{sandboxResult.modelled}k
              </div>
              <div data-testid="whatif-sandbox-range" className="font-pa-mono text-xs text-pa-grey-03">
                £{sandboxResult.rangeLow}k – £{sandboxResult.rangeHigh}k
              </div>
              {isTweaked && (
                <div
                  className={`mt-1.5 rounded-full px-2 py-0.5 font-pa-mono text-[11px] font-semibold ${
                    delta > 0
                      ? 'bg-pa-lime-01 text-pa-lime-04'
                      : delta < 0
                        ? 'bg-pa-rose-01 text-pa-rose-04'
                        : 'bg-pa-grey-01 text-pa-grey-03'
                  }`}
                >
                  {delta > 0 ? '+' : ''}
                  {delta}k vs stored
                </div>
              )}
            </div>

            {/* Right adjusters */}
            <div className="flex flex-col gap-4">
              <AdjusterPanel title="Grade / role" valueDisplay={`${GRADE_TABLE[inputs.grade].roleFactor}`}>
                <select
                  data-testid="whatif-grade-select"
                  className="w-full rounded-md border border-pa-grey-02 bg-pa-white px-2 py-1.5 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-03"
                  value={inputs.grade}
                  onChange={(e) => setInputs((prev) => (prev ? { ...prev, grade: e.target.value as Grade } : prev))}
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
              </AdjusterPanel>

              <div className="rounded-xl border border-pa-grey-01 bg-pa-grey-wash p-4">
                <div className="font-pa-body text-xs font-semibold uppercase tracking-wide text-pa-grey-03">
                  Currently stored ({target.status})
                </div>
                <div data-testid="whatif-stored-modelled" className="mt-1 font-pa-mono text-2xl font-bold text-pa-grey-04">
                  £{storedFinal}k
                </div>
                <div className="font-pa-body text-xs text-pa-grey-03">
                  {target.override
                    ? `Modelled was £${target.modelled}k · range £${target.rangeLow}k – £${target.rangeHigh}k`
                    : `Range £${target.rangeLow}k – £${target.rangeHigh}k`}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isTweaked && (
              <button
                type="button"
                onClick={() => setInputs(inputsFromPerson(person))}
                className="rounded-md border border-pa-grey-02 px-3 py-1.5 font-pa-body text-sm font-medium text-pa-grey-04 hover:bg-pa-grey-01"
              >
                Reset to current values
              </button>
            )}
            <p className="font-pa-body text-xs text-pa-grey-03">
              Scenario only — it never changes {person.name}&apos;s stored record. To apply a value as an actual
              override with a reason, use Manager override.
            </p>
          </div>
        </div>
      ) : (
        <p className="font-pa-body text-sm text-pa-grey-03">Select a person above to start a what-if scenario.</p>
      )}
    </section>
  )
}
