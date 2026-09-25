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
 * Deliberately omitted: the spec's "search" utility icon. A non-functional
 * search affordance in a sponsor demo invites a click that does nothing.
 * The notification indicator IS wired to real data — System 1's open
 * exception count, the same detectExceptions() the queue itself uses.
 */

const SYSTEM_1_LINKS = [
  { to: '/system1/overview', label: 'Overview' },
  { to: '/system1/override', label: 'Override' },
  { to: '/system1/exceptions', label: 'Exceptions' },
  { to: '/system1/mass-adjustment', label: 'Mass adjust' },
]

const SYSTEM_2_LINKS = [
  { to: '/system2/executive-summary', label: 'Executive summary' },
  { to: '/system2/division-comparison', label: 'Divisions' },
  { to: '/system2/scenario-workspace', label: 'Scenarios' },
]

const screenLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-pa-chip px-3 py-1.5 font-pa-body text-sm font-medium transition-colors ${
    isActive ? 'bg-pa-white/15 text-pa-white' : 'text-pa-grey-02 hover:bg-pa-white/10 hover:text-pa-white'
  }`

const systemLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-pa-chip px-3 py-1.5 font-pa-body text-xs font-semibold uppercase tracking-wide transition-colors ${
    isActive ? 'bg-pa-aqua-04 text-pa-white' : 'text-pa-grey-02 hover:text-pa-white'
  }`

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const targets = useSystem1Store((state) => state.targets)
  const inSystem2 = location.pathname.startsWith('/system2')
  const links = inSystem2 ? SYSTEM_2_LINKS : SYSTEM_1_LINKS
  const openExceptions = detectExceptions({ people: SEED_PEOPLE, targets }).size

  return (
    <div className="min-h-screen bg-pa-grey-wash text-pa-grey-04">
      <header className="bg-pa-dark-blue">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <span className="font-pa-display text-lg font-semibold tracking-tight text-pa-white">Searchlight</span>

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
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-pa-grey-02 transition-colors hover:bg-pa-white/10 hover:text-pa-white"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5v3L4 13h12l-1.5-3V7A4.5 4.5 0 0 0 10 2.5Z" strokeLinejoin="round" />
                <path d="M8 15.5a2 2 0 0 0 4 0" strokeLinecap="round" />
              </svg>
              {openExceptions > 0 && (
                <span
                  data-testid="nav-exception-count"
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-pa-mono text-[10px] font-bold text-pa-dark-blue"
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
              className="rounded-pa-chip border border-pa-white/25 px-3 py-1.5 font-pa-body text-xs font-medium text-pa-grey-02 transition-colors hover:bg-pa-white/10 hover:text-pa-white"
            >
              Reset demo data
            </button>

            <span
              title="Demo user — this POC has no real sign-in"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-pa-aqua-04 font-pa-mono text-xs font-bold text-pa-white"
            >
              JT
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}
