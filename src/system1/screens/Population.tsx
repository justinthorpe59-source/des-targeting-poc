import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { DIVISIONS, LOCATIONS } from '../data/types'
import { ALL, ALL_TEAMS, DEFAULT_FILTER, filterPeople, type PopulationFilter } from '../engine/filterPeople'
import { useSystem1Store } from '../../store/system1Store'

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none'

function FilterSelect({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  testId: string
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      <select
        data-testid={testId}
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value={ALL}>All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

// M4: filterable population list. Division/team/location combine with AND
// logic; each defaults to "All". Filtering itself lives in filterPeople()
// (src/system1/engine/filterPeople.ts) so M10's mass adjustment can reuse
// the exact same logic rather than duplicating it.
// M5: rows navigate to Individual Detail.
export function Population() {
  const [filter, setFilter] = useState<PopulationFilter>(DEFAULT_FILTER)
  const targets = useSystem1Store((state) => state.targets)
  const navigate = useNavigate()

  const filtered = useMemo(() => filterPeople(SEED_PEOPLE, filter), [filter])

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Population</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Filterable list of everyone in DES — Design, Engineering &amp; Science.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <FilterSelect
          label="Division"
          value={filter.division}
          options={[...DIVISIONS]}
          onChange={(value) => setFilter((f) => ({ ...f, division: value as PopulationFilter['division'] }))}
          testId="filter-division"
        />
        <FilterSelect
          label="Team"
          value={filter.team}
          options={ALL_TEAMS}
          onChange={(value) => setFilter((f) => ({ ...f, team: value }))}
          testId="filter-team"
        />
        <FilterSelect
          label="Location"
          value={filter.location}
          options={[...LOCATIONS]}
          onChange={(value) => setFilter((f) => ({ ...f, location: value as PopulationFilter['location'] }))}
          testId="filter-location"
        />
        {(filter.division !== ALL || filter.team !== ALL || filter.location !== ALL) && (
          <button
            type="button"
            onClick={() => setFilter(DEFAULT_FILTER)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Clear filters
          </button>
        )}
        <span data-testid="result-count" className="ml-auto text-sm text-slate-500">
          Showing {filtered.length} of {SEED_PEOPLE.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Division</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Modelled target</th>
            </tr>
          </thead>
          <tbody data-testid="population-rows" className="divide-y divide-slate-100">
            {filtered.map((person) => {
              const target = targets[person.id]
              return (
                <tr
                  key={person.id}
                  data-testid="population-row"
                  data-person-id={person.id}
                  tabIndex={0}
                  role="link"
                  onClick={() => navigate(`/system1/person/${person.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/system1/person/${person.id}`)
                  }}
                  className="cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{person.id}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{person.name}</td>
                  <td className="px-3 py-2 text-slate-600">{person.division}</td>
                  <td className="px-3 py-2 text-slate-600">{person.team}</td>
                  <td className="px-3 py-2 text-slate-600">{person.location}</td>
                  <td className="px-3 py-2 text-slate-600">
                    G{person.gradeCode} {person.roleTitle}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{target?.status ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    {target ? `£${target.modelled}k` : '—'}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                  No one matches this filter combination.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
