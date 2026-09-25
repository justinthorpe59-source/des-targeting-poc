import { NavLink, Outlet, useLocation } from 'react-router-dom'
import FadeContent from '../components/react-bits/FadeContent'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 font-pa-body text-sm font-medium transition-colors ${
    isActive ? 'bg-pa-aqua-05 text-pa-white' : 'text-pa-grey-03 hover:bg-pa-grey-01'
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
    <div className="flex gap-8 bg-pa-grey-wash">
      <aside className="w-48 shrink-0">
        <nav className="flex flex-col gap-1">
          <NavLink to="overview" className={navLinkClass}>
            Overview &amp; Population
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
