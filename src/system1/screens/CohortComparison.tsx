import { useNavigate, useParams } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store } from '../../store/system1Store'
import { CohortComparisonPanel } from '../components/CohortComparisonPanel'
import { ScreenHeading } from '../../components/searchlight/ScreenHeading'
import { SketchScatter } from '../../components/searchlight/SketchIllustrations'

// M6: person vs team avg vs division avg. Averaging logic lives in
// cohortAverages.ts. Searchlight design pass: the comparison itself now
// renders through the shared CohortComparisonPanel (also embedded on
// Individual Detail); this standalone screen keeps its own person picker so
// the sidebar entry point and /cohort routes stay intact.
export function CohortComparison() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const targets = useSystem1Store((state) => state.targets)

  const sortedPeople = [...SEED_PEOPLE].sort((a, b) => a.name.localeCompare(b.name))
  const person = id ? SEED_PEOPLE.find((p) => p.id === id) : undefined
  const target = person ? targets[person.id] : undefined

  return (
    <section className="relative max-w-2xl space-y-6">
      <SketchScatter className="pointer-events-none absolute right-0 top-6 -z-10 h-[300px] w-[460px] max-w-none opacity-[0.06]" />

      <ScreenHeading title="Cohort comparison">
        See how a person&apos;s revenue contribution compares to their team and division averages.
      </ScreenHeading>

      <label className="flex flex-col gap-1 font-pa-body text-xs font-medium text-pa-grey-03">
        Person
        <select
          data-testid="cohort-person-select"
          className="max-w-sm rounded-md border border-pa-grey-02 bg-pa-white px-2 py-1.5 font-pa-body text-sm text-pa-grey-04 focus:border-pa-aqua-04 focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-03"
          value={person?.id ?? ''}
          onChange={(e) => navigate(`/system1/cohort/${e.target.value}`)}
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

      {person && target ? (
        <CohortComparisonPanel person={person} />
      ) : (
        <p className="font-pa-body text-sm text-pa-grey-03">Select a person above to see their comparison.</p>
      )}
    </section>
  )
}
