import { NavLink, Outlet } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

// S2-M0: sidebar/tab nav layout for System 2's screens, mirroring
// System1Root's structure exactly. Only Screen A / Screen B exist here —
// the real 6 screens (Executive summary, Division comparison, Team
// drill-down, Scenario workspace, Scenario library, Exceptions/risk flags)
// replace these one milestone at a time starting S2-M4, same as System 1
// deferred its real screens to M3 onward rather than naming them at M0.
export function System2Root() {
  return (
    <div className="flex gap-8">
      <aside className="w-48 shrink-0">
        <nav className="flex flex-col gap-1">
          <NavLink to="a" className={navLinkClass}>
            Screen A
          </NavLink>
          <NavLink to="b" className={navLinkClass}>
            Screen B
          </NavLink>
        </nav>
      </aside>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}
