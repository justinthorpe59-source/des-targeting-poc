import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SEED_PEOPLE } from '../data/people'
import { useSystem1Store } from '../../store/system1Store'
import { explainTarget } from '../engine/explainTarget'
import { combinedRevenueFor } from '../engine/revenueEngine'
import { StatusPipeline } from '../components/StatusPipeline'
import { CohortComparisonPanel } from '../components/CohortComparisonPanel'
import { StatusPill } from '../../components/searchlight/StatusPill'
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

/**
 * One attribute chip, matching the reference's anatomy: muted label top-left,
 * small percentage badge top-right, bold value below, each in its own
 * bordered box.
 *
 * `badge` is optional on purpose. Only capacity and role carry a multiplier
 * that can honestly be read as a percentage; location and discipline select
 * WHICH baseline applies rather than scaling it, so they have no percentage
 * and their badge slot stays empty rather than being filled with an invented
 * number.
 */
/** How many change entries show before the rest are put behind a reveal.
 *  Two, matching the reference's own lower area. */
const HISTORY_PREVIEW = 2

/**
 * The lower area shows exactly one panel at a time. Explanation and Personal
 * context joined Recent updates and Cohort comparison here rather than
 * standing as permanent blocks above: the reference never shows more than one
 * thing in this region, and as always-visible sections they doubled the
 * screen's height for content a manager reads once.
 */
type DetailTab = 'explanation' | 'notes' | 'history' | 'cohort'

const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'explanation', label: 'Explanation' },
  { id: 'notes', label: 'Personal context' },
  { id: 'history', label: 'Recent updates' },
  { id: 'cohort', label: 'Cohort comparison' },
]

function AttributeChip({
  label,
  badge,
  value,
  testId,
}: {
  label: string
  badge?: string
  value: string
  testId: string
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-pa-chip px-5 py-4"
      /* Soft fill plus a hint of elevation, no border: the chip should read as
         a distinct object inside the card without introducing a second boxed
         edge competing with the card's own. */
      style={{
        background: 'var(--color-pa-grey-wash)',
        boxShadow: '0 1px 3px rgba(2, 77, 120, 0.06)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-pa-body text-xs text-pa-grey-03">{label}</span>
        {badge && (
          <span
            data-testid={`${testId}-badge`}
            className="shrink-0 rounded-full px-2 py-0.5 font-pa-mono text-[11px] font-semibold"
            style={{ background: 'var(--color-pa-grey-01)', color: 'var(--color-pa-grey-03)' }}
          >
            {badge}
          </span>
        )}
      </div>
      <div data-testid={`${testId}-value`} className="mt-1.5 font-pa-body text-base font-semibold text-pa-grey-04">
        {value}
      </div>
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
  // Declared before the not-found early return below: a hook after a
  // conditional return changes hook order between renders.
  const [detailTab, setDetailTab] = useState<DetailTab>('explanation')
  const [showAllHistory, setShowAllHistory] = useState(false)

  const person = SEED_PEOPLE.find((p) => p.id === id)
  const target = person ? targets[person.id] : undefined

  if (!person || !target) {
    return (
      <section className="space-y-4">
        <p className="font-pa-body text-sm text-pa-grey-03">No record found for id &quot;{id}&quot;.</p>
        <Link to="/system1/overview" className="font-pa-body text-sm font-medium text-pa-aqua-05 underline">
          Back to Population
        </Link>
      </section>
    )
  }

  const personHistory = auditLog.filter((entry) => entry.personId === person.id)

  /**
   * Newest first, with consecutive identical entries collapsed. Repeating the
   * same action with the same detail produces rows that look like separate
   * information but are not — most often a demo artefact of the same action
   * being applied twice, but equally possible in real use. Only CONSECUTIVE
   * duplicates collapse, so a genuine later repeat after some other change
   * still shows as its own event.
   */
  const history: typeof personHistory = []
  for (const entry of [...personHistory].reverse()) {
    const prev = history[history.length - 1]
    if (prev && prev.action === entry.action && prev.detail === entry.detail) continue
    history.push(entry)
  }
  const visibleHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW)

  return (
    <section className="relative space-y-6">
      <SketchDistribution className="pointer-events-none absolute right-0 top-10 -z-10 h-[300px] w-[480px] max-w-none opacity-[0.05]" />

      <div>
        <Link to="/system1/overview" className="font-pa-body text-xs font-medium text-pa-grey-03 hover:text-pa-grey-04">
          ← Back to Population
        </Link>
      </div>

      {loading ? (
        <SearchlightLoader />
      ) : (
        <div className="animate-[pa-fade-in_500ms_ease-out] space-y-8">
          {/*
            Hero card — two zones per searchlight-visual-spec.md and the
            reference: left ~58% identity + data, right ~42% a large square
            visual.

            The right zone is an avatar/photo PLACEHOLDER, per Justin's
            ruling (25 Sept 2026): Cohort Comparison is already merged onto
            this screen as its own panel, so putting the chart in the hero
            too would just duplicate it.

            Left zone order follows the reference exactly: identity row
            (avatar + name + grey subtext), then a stat row pairing a large
            value with a secondary value, then a metadata row, then actions.
          */}
          {/*
            ONE continuous card for everything above the fold. The reference
            uses exactly two tiers of surface: a single main card holding
            identity, stats, attributes and the visual — its internal sections
            divided by headers and thin rules, NOT by their own borders — and
            then small standalone cards beneath for the history items. Giving
            Attributes / Explanation / Personal context each their own bordered
            box put four competing surfaces on one screen where the reference
            has one. No content is cut; it is the same fields on fewer
            surfaces.
          */}
          <div className="overflow-hidden rounded-pa-card border border-pa-grey-01 bg-pa-white">
            <div className="grid gap-10 p-8 lg:grid-cols-[58fr_42fr]">
              {/* ---- Left zone: identity + data ---- */}
              <div className="flex flex-col">
                {/* identity row */}
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-pa-mono text-sm font-bold text-pa-white"
                    style={{ background: 'var(--color-pa-aqua-05)' }}
                  >
                    {initials(person.name)}
                  </span>
                  <div className="min-w-0">
                    <h1 className="font-pa-display text-2xl font-semibold leading-tight text-pa-grey-04">
                      {person.name}
                    </h1>
                    <p className="mt-0.5 font-pa-body text-sm text-pa-grey-03">
                      <span className="font-pa-mono">{person.id}</span> · {person.grade} · {person.division} /{' '}
                      {person.team}
                    </p>
                  </div>
                  <span className="ml-auto shrink-0">
                    <StatusPill state={target.status} testId="detail-status" />
                  </span>
                </div>

                {/* stat row — large value paired with a secondary value */}
                <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div data-testid="detail-modelled" className="font-pa-mono text-4xl font-bold leading-none text-pa-grey-04">
                      £{combinedRevenueFor(person)}k
                    </div>
                    <div className="mt-1.5 font-pa-body text-sm text-pa-grey-03">Revenue contribution</div>
                  </div>
                  <div>
                    {target.override ? (
                      <>
                        <div
                          data-testid="detail-override"
                          className="font-pa-mono text-4xl font-bold leading-none text-pa-grey-04"
                        >
                          £{target.override.finalValue}k
                        </div>
                        <div className="mt-1.5 font-pa-body text-sm text-pa-grey-03">
                          Adjusted from £{target.modelled}k
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          data-testid="detail-range"
                          className="font-pa-mono text-4xl font-bold leading-none text-pa-grey-04"
                        >
                          £{target.rangeLow}k–{target.rangeHigh}k
                        </div>
                        <div className="mt-1.5 font-pa-body text-sm text-pa-grey-03">Target range</div>
                      </>
                    )}
                  </div>
                </div>

                {/*
                  The caption line that used to sit here is gone. Every part
                  of it was already on screen: location is an Attributes chip,
                  the modelled figure is the stat row's secondary label (and
                  the Explanation names it when there is no override), and the
                  override reason is the body of its own history card. It was
                  restating three things rather than adding a fourth.
                */}

                {/* actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {(target.status === 'Modelled' || target.status === 'Adjusted') && (
                    <button
                      type="button"
                      data-testid="propose-button"
                      onClick={() => proposeRecord(person.id)}
                      className="rounded-full bg-pa-aqua-05 px-4 py-2 font-pa-body text-xs font-semibold text-pa-white transition-colors hover:bg-pa-aqua-04"
                    >
                      Propose
                    </button>
                  )}
                  {target.status === 'Proposed' && (
                    <button
                      type="button"
                      data-testid="approve-button"
                      onClick={() => approveRecord(person.id)}
                      className="rounded-full bg-pa-aqua-05 px-4 py-2 font-pa-body text-xs font-semibold text-pa-white transition-colors hover:bg-pa-aqua-04"
                    >
                      Approve
                    </button>
                  )}
                  <Link
                    to={`/system1/override/${person.id}`}
                    className="rounded-full bg-pa-grey-01 px-4 py-2 font-pa-body text-xs font-semibold text-pa-grey-04 transition-colors hover:bg-pa-grey-02/60"
                  >
                    Override / what-if
                  </Link>
                  <button
                    type="button"
                    data-testid="detail-go-cohort"
                    onClick={() => {
                      setDetailTab('cohort')
                      document.getElementById('detail-tab-cohort')?.scrollIntoView({ block: 'center' })
                    }}
                    className="rounded-full bg-pa-grey-01 px-4 py-2 font-pa-body text-xs font-semibold text-pa-grey-04 transition-colors hover:bg-pa-grey-02/60"
                  >
                    Compare to cohort
                  </button>
                </div>

                <div className="mt-7 max-w-md">
                  <StatusPipeline current={target.status} variant="compact" />
                </div>
              </div>

              {/* ---- Right zone: large square visual ---- */}
              {/* Capped: the spec calls for a full-width hero, but at a
                  full-bleed 1700px the 42% zone becomes a ~670px square that
                  drags the whole card down. Trimmed again once Explanation
                  and Personal context moved into the tabs — with the left
                  column that much shorter, the previous 340px square left an
                  obvious void beneath the content. */}
              <div
                data-testid="detail-hero-visual"
                aria-hidden="true"
                className="ml-auto flex aspect-square w-full max-w-[268px] items-center justify-center rounded-pa-card"
                style={{ background: 'var(--color-pa-grey-01)' }}
              >
                {/* Placeholder, not a chart. Real headshots replace this. */}
                <svg viewBox="0 0 24 24" className="h-2/5 w-2/5" fill="none" stroke="var(--color-pa-grey-02)" strokeWidth="1.4">
                  <circle cx="12" cy="9" r="3.6" />
                  <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {target.status === 'Pending Sign-off' && (
              <p
                data-testid="detail-pending-signoff-banner"
                className="border-t border-pa-grey-01 px-6 py-3 font-pa-body text-xs text-pa-grey-04"
                style={{ background: 'var(--color-pa-apricot-01)' }}
              >
                This change is pending sign-off from {person.division} / {person.team}&apos;s leadership group — it
                hasn&apos;t applied as final yet.{' '}
                <Link to="/system1/exceptions" className="font-medium text-pa-grey-04 underline">
                  View the Sign-off Queue →
                </Link>
              </p>
            )}

          {/*
            Attributes — the four locked target factors, one chip each, in a
            2x2 grid.

            searchlight-visual-spec.md originally called for a 4-column x
            2-row grid here. That was transcribed from the reference image,
            which happens to carry 8 NFT traits; CLAUDE.md locks the target
            factors to exactly four ("only these"). The spec line has been
            corrected to match. Resolved 26 Sept 2026.

            Badges carry each factor's real multiplier read as a percentage.
            Location and discipline have no multiplier -- they select which
            baseline applies rather than scaling it -- so those two chips
            carry a value and no badge, rather than an invented percentage.
          */}
            <div className="border-t border-pa-grey-01 p-8">
              <h2 className="mb-5 font-pa-display text-sm font-semibold text-pa-grey-04">Attributes</h2>
              <div data-testid="detail-attributes" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-3xl">
                <AttributeChip
                  testId="attr-role"
                label="Role"
                badge={`${Math.round(person.roleFactor * 100)}%`}
                value={person.grade}
              />
              <AttributeChip
                testId="attr-capacity"
                label="Capacity"
                badge={`${Math.round(person.capacity * 100)}%`}
                value={`${person.capacity} of full-time`}
              />
                <AttributeChip testId="attr-location" label="Location" value={person.location} />
                <AttributeChip testId="attr-discipline" label="Discipline" value={person.division} />
              </div>
            </div>

          {/*
            Supporting detail as a TAB PANEL, not a stack.

            searchlight-visual-spec.md puts Cohort Comparison on this screen
            "as a tab/panel" post-consolidation. It was rendering as a
            permanently-stacked section below the history, so both views were
            visible at once — which is precisely what a tab is not. The two
            tabs are the person's change history and their cohort comparison:
            both are supporting detail about one person, and only one is
            needed at a time.
          */}
            <div className="border-t border-pa-grey-01 p-8">
              <div
                role="tablist"
                aria-label="Supporting detail"
                className="flex flex-wrap gap-1 border-b border-pa-grey-01"
              >
                {DETAIL_TABS.map(({ id, label }) => {
                  const active = detailTab === id
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      id={`detail-tab-${id}`}
                      aria-selected={active}
                      aria-controls={`detail-panel-${id}`}
                      data-testid={`detail-tab-${id}`}
                      onClick={() => setDetailTab(id)}
                      className={`-mb-px border-b-2 px-4 py-2.5 font-pa-body text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pa-aqua-04 ${
                        active
                          ? 'border-pa-aqua-05 text-pa-grey-04'
                          : 'border-transparent text-pa-grey-03 hover:text-pa-grey-04'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              <div
                role="tabpanel"
                id="detail-panel-explanation"
                aria-labelledby="detail-tab-explanation"
                hidden={detailTab !== 'explanation'}
                className="pt-7"
              >
                <p
                  data-testid="detail-explanation"
                  className="max-w-4xl font-pa-body text-sm leading-relaxed text-pa-grey-04"
                >
                  {explainTarget(person, target)}
                </p>
              </div>

              <div
                role="tabpanel"
                id="detail-panel-notes"
                aria-labelledby="detail-tab-notes"
                hidden={detailTab !== 'notes'}
                className="pt-7"
              >
                {target.notes ? (
                  <p
                    data-testid="detail-notes"
                    className="max-w-4xl font-pa-body text-sm leading-relaxed text-pa-grey-04"
                  >
                    {target.notes}
                  </p>
                ) : (
                  <p
                    data-testid="detail-notes-empty"
                    className="max-w-4xl font-pa-body text-sm leading-relaxed text-pa-grey-03"
                  >
                    No notes yet. Managers can add personal context (strengths, interests, goals) from the override
                    screen.
                  </p>
                )}
              </div>

            <div
              role="tabpanel"
              id="detail-panel-history"
              aria-labelledby="detail-tab-history"
              hidden={detailTab !== 'history'}
              className="pt-7"
            >
              {history.length === 0 ? (
                /* Empty state keeps the card structure rather than collapsing
                   to a line of text, so the section reads the same shape
                   whether or not this person has history yet. */
                <div
                  data-testid="detail-history-empty"
                  className="rounded-pa-card p-7 md:max-w-lg"
                  style={{
                    background: 'var(--color-pa-grey-wash)',
                    boxShadow: '0 1px 3px rgba(2, 77, 120, 0.06)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-pa-mono text-xs text-pa-grey-02">No activity yet</span>
                    <span className="rounded-full bg-pa-grey-01 px-2.5 py-1 font-pa-body text-[11px] font-semibold text-pa-grey-03">
                      —
                    </span>
                  </div>
                  <h3 className="mt-4 font-pa-display text-base font-semibold text-pa-grey-03">
                    Nothing recorded for {person.name.split(' ')[0]}
                  </h3>
                  <p className="mt-2 font-pa-body text-sm leading-relaxed text-pa-grey-03">
                    This record is still at its modelled value. Adjusting, proposing or approving it will log the
                    change here, with who made it and why.
                  </p>
                </div>
              ) : (
                <div data-testid="detail-history" className="grid gap-5 md:grid-cols-2">
                  {visibleHistory.map((entry) => (
                      <article
                        key={entry.id}
                        data-testid="detail-history-card"
                        className="rounded-pa-card p-7"
                        /* Soft fill + a hint of elevation instead of a border:
                           these need to read as distinct objects inside the
                           card without adding a second boxed edge. */
                        style={{
                          background: 'var(--color-pa-grey-wash)',
                          boxShadow: '0 1px 3px rgba(2, 77, 120, 0.06)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-pa-mono text-xs text-pa-grey-03">{entry.timestamp}</span>
                          <span
                            data-testid="detail-history-actor"
                            className="shrink-0 rounded-full px-2.5 py-1 font-pa-body text-[11px] font-semibold"
                            style={{
                              background: 'var(--color-pa-aqua-01)',
                              color: 'var(--color-pa-aqua-05)',
                            }}
                          >
                            {entry.actor}
                          </span>
                        </div>
                        <h3 className="mt-4 font-pa-display text-base font-semibold text-pa-grey-04">
                          {entry.action}
                        </h3>
                        <p className="mt-2 font-pa-body text-sm leading-relaxed text-pa-grey-03">{entry.detail}</p>
                      </article>
                    ))}
                </div>
              )}

              {history.length > HISTORY_PREVIEW && (
                <button
                  type="button"
                  data-testid="detail-history-toggle"
                  onClick={() => setShowAllHistory((v) => !v)}
                  className="mt-5 rounded-full bg-pa-grey-01 px-4 py-2 font-pa-body text-xs font-semibold text-pa-grey-04 transition-colors hover:bg-pa-grey-02/60"
                >
                  {showAllHistory
                    ? 'Show fewer'
                    : `Show all ${history.length} changes`}
                </button>
              )}
            </div>

            <div
              role="tabpanel"
              id="detail-panel-cohort"
              aria-labelledby="detail-tab-cohort"
              hidden={detailTab !== 'cohort'}
              className="pt-7"
            >
                <div id="cohort" className="scroll-mt-6">
                  <CohortComparisonPanel person={person} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
