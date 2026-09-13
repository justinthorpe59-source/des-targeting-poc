import { NavLink, Outlet } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

// Sidebar/tab nav layout for System 1's screens. Only Screen A / Screen B
// exist at M0 — the real 11 screens replace these one milestone at a time
// starting M3, without needing to touch this layout.
export function System1Root() {
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
