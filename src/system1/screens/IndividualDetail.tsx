import { Link, useParams } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store } from '../../store/system1Store'
import { explainTarget } from '../engine/explainTarget'
import { combinedRevenueFor } from '../engine/revenueEngine'
import { StatusPipeline } from '../components/StatusPipeline'
import { CohortComparisonPanel } from '../components/CohortComparisonPanel'
import { SearchlightLoader } from '../../components/searchlight/SearchlightLoader'
import { SketchDistribution } from '../../components/searchlight/SketchIllustrations'
import { useInitialLoad } from '../../components/searchlight/useInitialLoad'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function Attribute({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2">
      <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">{label}</div>
      <div className="mt-0.5 font-pa-mono text-sm font-bold text-pa-grey-04">{value}</div>
    </div>
  )
}

// M5: factor breakdown, plain-language explanation, personal context, and
// this person's change history. Searchlight design pass: reference-led
// profile layout (header + attributes grid + recent changes), and — per the
// product owner — the Cohort comparison is embedded as the scroll-down
// section at the bottom (via the shared CohortComparisonPanel), while the
// standalone Cohort screen stays intact.
export function IndividualDetail() {
  const { id } = useParams<{ id: string }>()
  const targets = useSystem1Store((state) => state.targets)
  const auditLog = useSystem1Store((state) => state.auditLog)
  const proposeRecord = useSystem1Store((state) => state.proposeRecord)
  const approveRecord = useSystem1Store((state) => state.approveRecord)
  const loading = useInitialLoad(true)

  const person = SEED_PEOPLE.find((p) => p.id === id)
  const target = person ? targets[person.id] : undefined

  if (!person || !target) {
    return (
      <section className="space-y-4">
        <p className="font-pa-body text-sm text-pa-grey-03">No record found for id &quot;{id}&quot;.</p>
        <Link to="/system1/population" className="font-pa-body text-sm font-medium text-pa-aqua-05 underline">
          Back to Population
        </Link>
      </section>
    )
  }

  const personHistory = auditLog.filter((entry) => entry.personId === person.id)

  return (
    <section className="relative max-w-3xl space-y-6">
      <SketchDistribution className="pointer-events-none absolute right-0 top-10 -z-10 h-[300px] w-[480px] max-w-none opacity-[0.05]" />

      <div>
        <Link to="/system1/population" className="font-pa-body text-xs font-medium text-pa-grey-03 hover:text-pa-grey-04">
          ← Back to Population
        </Link>
      </div>

      {loading ? (
        <SearchlightLoader />
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-6">
          {/* Profile header */}
          <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-pa-grey-01 bg-pa-grey-wash font-pa-mono text-lg font-bold text-pa-aqua-05">
                  {initials(person.name)}
                </div>
                <div>
                  <h1 className="font-pa-display text-2xl font-semibold leading-tight text-pa-grey-04">{person.name}</h1>
                  <p className="mt-0.5 font-pa-body text-sm text-pa-grey-03">
                    <span className="font-pa-mono">{person.id}</span> · {person.division} · {person.team} ·{' '}
                    {person.location} · {person.grade}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span data-testid="detail-status" className="font-pa-body text-xs font-medium text-pa-grey-03">
                  {target.status}
                </span>
                {(target.status === 'Modelled' || target.status === 'Adjusted') && (
                  <button
                    type="button"
                    data-testid="propose-button"
                    onClick={() => proposeRecord(person.id)}
                    className="rounded-md border border-pa-grey-02 px-2 py-1 font-pa-body text-xs font-medium text-pa-grey-04 hover:bg-pa-grey-01"
                  >
                    Propose
                  </button>
                )}
                {target.status === 'Proposed' && (
                  <button
                    type="button"
                    data-testid="approve-button"
                    onClick={() => approveRecord(person.id)}
                    className="rounded-md bg-pa-aqua-05 px-2 py-1 font-pa-body text-xs font-medium text-pa-white hover:bg-pa-aqua-04"
                  >
                    Approve
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <StatusPipeline current={target.status} />
            </div>

            {target.status === 'Pending Sign-off' && (
              <p
                data-testid="detail-pending-signoff-banner"
                className="mt-4 rounded-md bg-pa-apricot-01 p-3 font-pa-body text-xs text-pa-grey-04"
              >
                This change is pending sign-off from {person.division} / {person.team}&apos;s leadership group — it
                hasn&apos;t applied as final yet.{' '}
                <Link to="/system1/signoff" className="font-medium text-pa-grey-04 underline">
                  View the Sign-off Queue →
                </Link>
              </p>
            )}

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
                  Revenue contribution
                </div>
                <div data-testid="detail-modelled" className="mt-1 font-pa-mono text-3xl font-bold text-pa-grey-04">
                  £{combinedRevenueFor(person)}k
                </div>
                <div className="font-pa-body text-xs text-pa-grey-03">Billable + sales-target revenue this converts to</div>
              </div>
              <div>
                <div className="font-pa-body text-[11px] font-medium uppercase tracking-wide text-pa-grey-03">
                  Target range
                </div>
                {target.override ? (
                  <div data-testid="detail-override" className="mt-1 font-pa-body text-sm text-pa-grey-04">
                    Adjusted to <span className="font-pa-mono">£{target.override.finalValue}k</span> (
                    {target.override.type === 'percent'
                      ? `${target.override.value > 0 ? '+' : ''}${target.override.value}%`
                      : 'direct value'}{' '}
                    from modelled <span className="font-pa-mono">£{target.modelled}k</span>). Reason:{' '}
                    {target.override.reason}
                  </div>
                ) : (
                  <div data-testid="detail-range" className="mt-1 font-pa-mono text-sm text-pa-grey-04">
                    £{target.rangeLow}k – £{target.rangeHigh}k
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 border-t border-pa-grey-01 pt-3">
              <a href="#cohort" className="font-pa-body text-xs font-medium text-pa-aqua-05 hover:text-pa-aqua-04">
                Compare to team/division ↓
              </a>
              <Link
                to={`/system1/whatif/${person.id}`}
                className="font-pa-body text-xs font-medium text-pa-aqua-05 hover:text-pa-aqua-04"
              >
                Try what-if →
              </Link>
              <Link
                to={`/system1/override/${person.id}`}
                className="font-pa-body text-xs font-medium text-pa-aqua-05 hover:text-pa-aqua-04"
              >
                Override →
              </Link>
            </div>
          </div>

          {/* Factor breakdown — attributes grid */}
          <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
            <h2 className="mb-2 font-pa-display text-sm font-semibold text-pa-grey-04">Factor breakdown</h2>
            <div className="grid grid-cols-2 divide-x divide-y divide-pa-grey-01 overflow-hidden rounded-lg border border-pa-grey-01 sm:grid-cols-4 sm:divide-y-0">
              <Attribute label="Baseline (£k)" value={`£${person.baseline}k`} />
              <Attribute label="Capacity factor" value={String(person.capacity)} />
              <Attribute label="Role factor" value={`${person.roleFactor} (${person.grade})`} />
              <Attribute label="Economic factor" value={String(person.economicFactor)} />
            </div>
          </div>

          {/* Explanation */}
          <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
            <h2 className="font-pa-display text-sm font-semibold text-pa-grey-04">Explanation</h2>
            <p data-testid="detail-explanation" className="mt-2 font-pa-body text-sm leading-relaxed text-pa-grey-04">
              {explainTarget(person, target)}
            </p>
          </div>

          {/* Personal context */}
          <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
            <h2 className="font-pa-display text-sm font-semibold text-pa-grey-04">Personal context</h2>
            {target.notes ? (
              <p data-testid="detail-notes" className="mt-2 font-pa-body text-sm text-pa-grey-04">
                {target.notes}
              </p>
            ) : (
              <p data-testid="detail-notes-empty" className="mt-2 font-pa-body text-sm text-pa-grey-03">
                No notes yet. Managers can add personal context (strengths, interests, goals) from the override screen.
              </p>
            )}
          </div>

          {/* Recent updates / changes */}
          <div className="rounded-xl border border-pa-grey-01 bg-pa-white p-4">
            <h2 className="font-pa-display text-sm font-semibold text-pa-grey-04">Recent updates &amp; changes</h2>
            {personHistory.length === 0 ? (
              <p data-testid="detail-history-empty" className="mt-2 font-pa-body text-sm text-pa-grey-03">
                No changes yet — this record hasn&apos;t been adjusted, proposed, or approved.
              </p>
            ) : (
              <ul data-testid="detail-history" className="mt-3 space-y-2">
                {personHistory.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-pa-grey-01 bg-pa-grey-wash p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-pa-body text-sm font-medium text-pa-grey-04">{entry.action}</span>
                      <span className="font-pa-mono text-[11px] text-pa-grey-03">{entry.timestamp}</span>
                    </div>
                    <div className="mt-0.5 font-pa-body text-sm text-pa-grey-03">
                      by {entry.actor} — {entry.detail}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Embedded cohort comparison — the scroll-down section */}
          <div id="cohort" className="scroll-mt-6">
            <CohortComparisonPanel person={person} />
          </div>
        </div>
      )}
    </section>
  )
}
