import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { DIVISIONS, LOCATIONS } from '../data/types'
import { ALL, ALL_TEAMS, DEFAULT_FILTER, filterPeople, type PopulationFilter } from '../engine/filterPeople'
import { useSystem1Store, type TargetStatus } from '../../store/system1Store'
import { finalTargetFor } from '../engine/finalTarget'

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none'

const STATUS_FILTER_OPTIONS: TargetStatus[] = ['Modelled', 'Adjusted', 'Proposed', 'Approved']

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
// M11: a Status filter doubles as the "snapshot preview" (filter to
// Approved to see exactly what M13's export will contain). Bulk Propose /
// Approve via row selection — folded in here per CLAUDE.md rather than a
// separate screen. A mixed selection is handled the same way M10 handles a
// mixed mass-adjustment filter: only eligible-state rows act, the rest are
// silently skipped and the skip count is shown.
export function Population() {
  const [filter, setFilter] = useState<PopulationFilter>(DEFAULT_FILTER)
  const [statusFilter, setStatusFilter] = useState<TargetStatus | typeof ALL>(ALL)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const targets = useSystem1Store((state) => state.targets)
  const proposeRecord = useSystem1Store((state) => state.proposeRecord)
  const approveRecord = useSystem1Store((state) => state.approveRecord)
  const navigate = useNavigate()

  const filtered = useMemo(() => {
    const base = filterPeople(SEED_PEOPLE, filter)
    if (statusFilter === ALL) return base
    return base.filter((p) => targets[p.id]?.status === statusFilter)
  }, [filter, statusFilter, targets])

  const selectedPeople = filtered.filter((p) => selectedIds.has(p.id))
  const proposeEligible = selectedPeople.filter((p) => {
    const status = targets[p.id]?.status
    return status === 'Modelled' || status === 'Adjusted'
  })
  const approveEligible = selectedPeople.filter((p) => targets[p.id]?.status === 'Proposed')

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      const allSelected = filtered.every((p) => prev.has(p.id))
      return allSelected ? new Set() : new Set(filtered.map((p) => p.id))
    })
  }

  function handleBulkPropose() {
    for (const p of proposeEligible) proposeRecord(p.id)
    setSelectedIds(new Set())
  }

  function handleBulkApprove() {
    for (const p of approveEligible) approveRecord(p.id)
    setSelectedIds(new Set())
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))

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
        <FilterSelect
          label="Status"
          value={statusFilter}
          options={STATUS_FILTER_OPTIONS}
          onChange={(value) => setStatusFilter(value as TargetStatus | typeof ALL)}
          testId="filter-status"
        />
        {(filter.division !== ALL || filter.team !== ALL || filter.location !== ALL || statusFilter !== ALL) && (
          <button
            type="button"
            onClick={() => {
              setFilter(DEFAULT_FILTER)
              setStatusFilter(ALL)
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Clear filters
          </button>
        )}
        <span data-testid="result-count" className="ml-auto text-sm text-slate-500">
          Showing {filtered.length} of {SEED_PEOPLE.length}
        </span>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-slate-50 p-3 text-sm">
          <span data-testid="selection-summary" className="text-slate-600">
            {selectedIds.size} selected — {proposeEligible.length} eligible to propose, {approveEligible.length}{' '}
            eligible to approve
          </span>
          <button
            type="button"
            data-testid="bulk-propose-button"
            disabled={proposeEligible.length === 0}
            onClick={handleBulkPropose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Propose {proposeEligible.length}
          </button>
          <button
            type="button"
            data-testid="bulk-approve-button"
            disabled={approveEligible.length === 0}
            onClick={handleBulkApprove}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Approve {approveEligible.length}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  data-testid="select-all-checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Division</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Target</th>
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
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      data-testid="row-checkbox"
                      checked={selectedIds.has(person.id)}
                      onChange={() => toggleRow(person.id)}
                    />
                  </td>
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
                    {target ? `£${finalTargetFor(target)}k${target.override ? ' *' : ''}` : '—'}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
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
