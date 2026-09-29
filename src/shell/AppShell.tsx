import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { SEED_PEOPLE } from '../system1/data/people'
import { useSystem1Store } from '../store/system1Store'
import { detectExceptions } from '../system1/engine/exceptions'
import { resetAllDemoData } from '../store/resetAll'

/**
 * Searchlight global navigation. Per searchlight-visual-spec.md: a top
 * navigation bar, not a sidebar — wordmark left, primary nav links inline,
 * utilities + profile right, on a bar background visually distinct (Dark
 * Blue) from the page body beneath it.
 *
 * This replaces the per-system sidebars that System1Root/System2Root used
 * to own, so screen links for whichever system is active now live up here
 * alongside the system switcher.
 *
 * Full bleed: the bar and the page body both run the full viewport width
 * (25 Sept 2026 decision, applies to every screen). Individual content that
 * would be unreadable at that measure — long prose especially — keeps its
 * own max-width rather than the shell imposing one globally.
 *
 * Deliberately omitted: the spec's "search" utility icon. A non-functional
 * search affordance in a sponsor demo invites a click that does nothing.
 * The notification indicator IS wired to real data — System 1's open
 * exception count, the same detectExceptions() the queue itself uses.
 */

const SYSTEM_1_LINKS = [
  { to: '/system1/overview', label: 'Overview' },
  { to: '/system1/exceptions', label: 'Exceptions' },
  { to: '/system1/mass-adjustment', label: 'Mass adjustment' },
]

const SYSTEM_2_LINKS = [
  { to: '/system2/executive-summary', label: 'Executive summary' },
  { to: '/system2/division-comparison', label: 'Divisions' },
  { to: '/system2/scenario-workspace', label: 'Scenarios' },
]

/*
 * Repainted 28 Sept 2026 (design reset). The bar was Dark Blue with white
 * type — the last surface still in the old palette, and the one most
 * responsible for the app reading as "blue chrome". It is now white, sitting
 * on the page's own near-white ground and separated by a hairline rather
 * than by a colour block.
 *
 * The active screen is the accent, which is exactly the "active/selected
 * state" case the direction reserves pink for. Dark ink on the accent, never
 * white: white on the accent measures 2.50:1 and fails AA.
 */
const screenLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-pa-chip px-4 py-2.5 font-pa-body text-base font-semibold transition-colors ${
    isActive
      ? 'bg-[var(--color-pa-accent)] text-[var(--color-pa-accent-ink)]'
      : 'text-pa-grey-03 hover:bg-pa-grey-01 hover:text-pa-grey-04'
  }`

/* The system switcher is structural, not an emphasis moment — two peers, one
   of which happens to be current. It takes a neutral fill so it does not
   compete with the active screen for the eye. */
const systemLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-pa-chip px-4 py-2.5 font-pa-body text-sm font-semibold uppercase tracking-wide transition-colors ${
    isActive ? 'border border-pa-grey-01 bg-pa-white text-pa-grey-04' : 'text-pa-grey-03 hover:text-pa-grey-04'
  }`

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const targets = useSystem1Store((state) => state.targets)
  const inSystem2 = location.pathname.startsWith('/system2')
  const links = inSystem2 ? SYSTEM_2_LINKS : SYSTEM_1_LINKS
  const openExceptions = detectExceptions({ people: SEED_PEOPLE, targets }).size

  return (
    <div className="min-h-screen bg-pa-white text-pa-grey-04">
      <header className="bg-pa-white">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3 px-8 py-5">
          <span className="font-pa-display text-2xl font-semibold tracking-tight text-pa-grey-04">Searchlight</span>

          <nav aria-label="System" className="flex gap-1">
            <NavLink to="/system1" className={systemLinkClass}>
              System 1
            </NavLink>
            <NavLink to="/system2" className={systemLinkClass}>
              System 2
            </NavLink>
          </nav>

          <nav aria-label="Screens" className="flex flex-wrap gap-1">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={screenLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <NavLink
              to="/system1/exceptions"
              title={`${openExceptions} open exception${openExceptions === 1 ? '' : 's'}`}
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-pa-grey-03 transition-colors hover:bg-pa-grey-01 hover:text-pa-grey-04"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5v3L4 13h12l-1.5-3V7A4.5 4.5 0 0 0 10 2.5Z" strokeLinejoin="round" />
                <path d="M8 15.5a2 2 0 0 0 4 0" strokeLinecap="round" />
              </svg>
              {openExceptions > 0 && (
                <span
                  data-testid="nav-exception-count"
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-pa-mono text-[11px] font-bold text-pa-dark-blue"
                  style={{ background: 'var(--color-pa-apricot-03)' }}
                >
                  {openExceptions}
                </span>
              )}
              <span className="sr-only">
                {openExceptions} open exception{openExceptions === 1 ? '' : 's'}
              </span>
            </NavLink>

            <button
              type="button"
              onClick={resetAllDemoData}
              className="rounded-pa-chip border border-pa-grey-02 px-4 py-2.5 font-pa-body text-sm font-medium text-pa-grey-04 transition-colors hover:bg-pa-grey-01"
            >
              Reset demo data
            </button>

            <span
              title="Demo user — this POC has no real sign-in"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-pa-grey-01 bg-pa-white font-pa-mono text-sm font-bold text-pa-grey-04"
            >
              JT
            </span>
          </div>
        </div>
      </header>

      {/*
        Page transition. Keyed on the pathname so React remounts the subtree
        on navigation and the entrance animation replays — a considered
        arrival rather than an instant cut, and short enough not to sit
        between the user and the screen they asked for.
      */}
      <main key={location.pathname} className="animate-pa-rise px-8 py-10">
        {children}
      </main>
    </div>
  )
}
