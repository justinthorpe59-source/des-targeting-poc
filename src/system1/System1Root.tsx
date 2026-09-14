import { NavLink, Outlet, useLocation } from 'react-router-dom'
import FadeContent from '../components/react-bits/FadeContent'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

// Sidebar/tab nav layout for System 1's screens. Real screens replace the
// M0 placeholders one milestone at a time — Overview landed at M3, the
// remaining 9 follow the same pattern without needing to touch this layout.
// M14: FadeContent (react-bits) wraps the routed screen, keyed to the
// current path so it remounts — and re-triggers its fade-in — on every
// navigation, not just once on first load.
export function System1Root() {
  const location = useLocation()
  return (
    <div className="flex gap-8">
      <aside className="w-48 shrink-0">
        <nav className="flex flex-col gap-1">
          <NavLink to="overview" className={navLinkClass}>
            Overview
          </NavLink>
          <NavLink to="population" className={navLinkClass}>
            Population
          </NavLink>
          <NavLink to="cohort" className={navLinkClass}>
            Cohort comparison
          </NavLink>
          <NavLink to="whatif" className={navLinkClass}>
            What-if sandbox
          </NavLink>
          <NavLink to="override" className={navLinkClass}>
            Manager override
          </NavLink>
          <NavLink to="exceptions" className={navLinkClass}>
            Exceptions queue
          </NavLink>
          <NavLink to="mass-adjustment" className={navLinkClass}>
            Mass adjustment
          </NavLink>
          <NavLink to="employee" className={navLinkClass}>
            Employee view
          </NavLink>
          <NavLink to="snapshot-export" className={navLinkClass}>
            Snapshot export
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
