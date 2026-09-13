import { Link, useParams } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store } from '../../store/system1Store'
import { explainTarget } from '../engine/explainTarget'

function FactorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums text-slate-900">{value}</span>
    </div>
  )
}

// M5: factor breakdown, plain-language explanation, personal context, and
// this person's change history. Approve action (M11) and notes editing (M8)
// land on this same screen later — not built here.
export function IndividualDetail() {
  const { id } = useParams<{ id: string }>()
  const targets = useSystem1Store((state) => state.targets)
  const auditLog = useSystem1Store((state) => state.auditLog)

  const person = SEED_PEOPLE.find((p) => p.id === id)
  const target = person ? targets[person.id] : undefined

  if (!person || !target) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-slate-600">No record found for id "{id}".</p>
        <Link to="/system1/population" className="text-sm font-medium text-slate-900 underline">
          Back to Population
        </Link>
      </section>
    )
  }

  const personHistory = auditLog.filter((entry) => entry.personId === person.id)

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <Link to="/system1/population" className="text-xs font-medium text-slate-500 hover:text-slate-700">
          ← Back to Population
        </Link>
        <h1 className="mt-1 text-lg font-semibold">{person.name}</h1>
        <p className="text-sm text-slate-600">
          {person.id} · {person.division} · {person.team} · {person.location} · Grade {person.gradeCode}{' '}
          {person.roleTitle}
        </p>
        <Link
          to={`/system1/cohort/${person.id}`}
          className="mt-1 inline-block text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Compare to team/division →
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Modelled target</h2>
          <span data-testid="detail-status" className="text-xs font-medium text-slate-500">
            {target.status}
          </span>
        </div>
        <div data-testid="detail-modelled" className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
          £{target.modelled}k
        </div>
        <div data-testid="detail-range" className="text-sm text-slate-500">
          Range £{target.rangeLow}k – £{target.rangeHigh}k
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Factor breakdown</h2>
        <div className="mt-2">
          <FactorRow label="Baseline (£k)" value={`£${person.baseline}k`} />
          <FactorRow label="Capacity factor" value={String(person.capacity)} />
          <FactorRow label="Role factor" value={`${person.roleFactor} (${person.roleTitle})`} />
          <FactorRow label="Economic factor" value={String(person.economicFactor)} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Explanation</h2>
        <p data-testid="detail-explanation" className="mt-2 text-sm leading-relaxed text-slate-700">
          {explainTarget(person, target)}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Personal context</h2>
        {target.notes ? (
          <p data-testid="detail-notes" className="mt-2 text-sm text-slate-700">
            {target.notes}
          </p>
        ) : (
          <p data-testid="detail-notes-empty" className="mt-2 text-sm text-slate-500">
            No notes yet. Managers can add personal context (strengths, interests, goals) from the override
            screen.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Change history</h2>
        {personHistory.length === 0 ? (
          <p data-testid="detail-history-empty" className="mt-2 text-sm text-slate-500">
            No changes yet — this record hasn't been adjusted, proposed, or approved.
          </p>
        ) : (
          <ul data-testid="detail-history" className="mt-2 space-y-2">
            {personHistory.map((entry) => (
              <li key={entry.id} className="text-sm text-slate-700">
                <span className="font-medium">{entry.action}</span> by {entry.actor} — {entry.detail}
                <span className="ml-2 text-xs text-slate-400">{entry.timestamp}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
