import { NavLink, Outlet, useLocation } from 'react-router-dom'
import FadeContent from '../components/react-bits/FadeContent'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 font-pa-body text-sm font-medium transition-colors ${
    isActive ? 'bg-pa-aqua-05 text-pa-white' : 'text-pa-grey-03 hover:bg-pa-grey-01'
  }`

// S2-M0: sidebar/tab nav layout for System 2's screens, mirroring
// System1Root's structure exactly. S2-M4 replaced Screen A with the real
// Executive summary (which absorbed Screen A's import action into its own
// empty state). S2-M5 added Division comparison. S2-M6 added Team
// drill-down, which retired Screen B. S2-M7 added Scenario workspace.
// S2-M8 added Scenario library. S2-M9 added Exceptions/risk flags, the
// last of the 6 locked screens. S2-M10: FadeContent (react-bits) wraps the
// routed screen, keyed to the current path so it remounts on every
// navigation — same pattern System1Root already uses, one shared wrapper
// covers all 6 System 2 screens rather than touching each file.
export function System2Root() {
  const location = useLocation()
  return (
    <div className="flex gap-8 bg-pa-grey-wash">
      <aside className="w-48 shrink-0">
        <nav className="flex flex-col gap-1">
          <NavLink to="executive-summary" className={navLinkClass}>
            Executive summary
          </NavLink>
          <NavLink to="division-comparison" className={navLinkClass}>
            Division comparison
          </NavLink>
          <NavLink to="scenario-workspace" className={navLinkClass}>
            Scenario workspace
          </NavLink>
          <NavLink to="scenario-library" className={navLinkClass}>
            Scenario library
          </NavLink>
        </nav>
      </aside>
      <div className="flex-1">
        <FadeContent key={location.pathname} duration={400} initialOpacity={0} className="min-h-0">
          <Outlet />
        </FadeContent>
      </div>
    </div>
  )
}
