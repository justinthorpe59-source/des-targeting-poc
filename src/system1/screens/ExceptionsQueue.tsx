import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store } from '../../store/system1Store'
import { detectExceptions, type ExceptionType } from '../engine/exceptions'
import { SignOffSection } from '../components/SignOffSection'

const TYPE_LABELS: Record<ExceptionType, string> = {
  'missing-data': 'Missing data',
  'extreme-value': 'Extreme value',
  'large-adjustment': 'Large adjustment',
}

const TYPE_BADGE_CLASS: Record<ExceptionType, string> = {
  'missing-data': 'bg-red-100 text-red-800',
  'extreme-value': 'bg-amber-100 text-amber-800',
  'large-adjustment': 'bg-purple-100 text-purple-800',
}

const FILTER_OPTIONS: Array<ExceptionType | 'All'> = ['All', 'missing-data', 'extreme-value', 'large-adjustment']

// M9: exceptions queue. Since the 5-screen consolidation this screen is the
// single reviewer inbox for System 1: threshold exceptions (below) plus the
// Pending sign-off queue (SignOffSection), which used to be its own screen.
// They are separate lists on purpose — an exception is a live threshold
// violation recomputed every render, a sign-off is a frozen decision waiting
// on a person.
//
// Original M9 note:
// M9: exceptions queue. detectExceptions() is the same shared function used
// for Overview's count (M3) and large-adjustment (M8) — this screen adds no
// new detection logic, just a list. Flags are recomputed live from the
// store on every render; there's no separate "resolved" state to manage —
// fixing the underlying record (an override, corrected data) is what makes
// a record drop off this list.
export function ExceptionsQueue() {
  const navigate = useNavigate()
  const targets = useSystem1Store((state) => state.targets)
  const [typeFilter, setTypeFilter] = useState<ExceptionType | 'All'>('All')

  const flagsByPerson = useMemo(() => detectExceptions({ people: SEED_PEOPLE, targets }), [targets])

  const rows = useMemo(() => {
    const entries = [...flagsByPerson.entries()]
      .map(([personId, flags]) => ({
        person: SEED_PEOPLE.find((p) => p.id === personId)!,
        flags: typeFilter === 'All' ? flags : flags.filter((f) => f.type === typeFilter),
      }))
      .filter((row) => row.flags.length > 0)
    entries.sort((a, b) => a.person.id.localeCompare(b.person.id))
    return entries
  }, [flagsByPerson, typeFilter])

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Exceptions queue</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Records that violate a locked threshold — missing data, an extreme value, or a large manual
          adjustment — plus changes waiting on a leadership sign-off. Flagged for review only; nothing here is
          ever blocked.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Type
          <select
            data-testid="exceptions-type-filter"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ExceptionType | 'All')}
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'All' ? 'All types' : TYPE_LABELS[opt]}
              </option>
            ))}
          </select>
        </label>
        <span data-testid="exceptions-count" className="ml-auto text-sm text-slate-500">
          {rows.length} flagged record{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Division / Team</th>
              <th className="px-3 py-2">Flags</th>
              <th className="px-3 py-2">Detail</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody data-testid="exceptions-rows" className="divide-y divide-slate-100">
            {rows.map(({ person, flags }) => (
              <tr
                key={person.id}
                data-testid="exceptions-row"
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
                <td className="px-3 py-2 text-slate-600">
                  {person.division} / {person.team}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {flags.map((flag, i) => (
                      <span
                        key={i}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASS[flag.type]}`}
                      >
                        {TYPE_LABELS[flag.type]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  <ul className="space-y-0.5">
                    {flags.map((flag, i) => (
                      <li key={i}>{flag.detail}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-2 text-right">
                  <a
                    href={`/system1/override/${person.id}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      navigate(`/system1/override/${person.id}`)
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    Override →
                  </a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                  No flagged records{typeFilter !== 'All' ? ` of type "${TYPE_LABELS[typeFilter]}"` : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <SignOffSection />
      </div>
    </section>
  )
}
