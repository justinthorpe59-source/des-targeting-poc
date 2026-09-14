import { NavLink, Outlet } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

// S2-M0: sidebar/tab nav layout for System 2's screens, mirroring
// System1Root's structure exactly. S2-M4 replaced Screen A with the real
// Executive summary (which absorbed Screen A's import action into its own
// empty state). S2-M5 adds Division comparison alongside it. Screen B
// remains as the S2-M2/M3 verification placeholder for team-level rollups
// and raw imported rows until Team drill-down (S2-M6) replaces it.
export function System2Root() {
  return (
    <div className="flex gap-8">
      <aside className="w-48 shrink-0">
        <nav className="flex flex-col gap-1">
          <NavLink to="executive-summary" className={navLinkClass}>
            Executive summary
          </NavLink>
          <NavLink to="division-comparison" className={navLinkClass}>
            Division comparison
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
