import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { resetAllDemoData } from '../store/resetAll'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-wide text-slate-500">
            DES TARGETING POC
          </span>
          <nav className="flex gap-1">
            <NavLink to="/system1" className={navLinkClass}>
              System 1 · Individual Targeting
            </NavLink>
            <NavLink to="/system2" className={navLinkClass}>
              System 2 · Organisational Operating
            </NavLink>
          </nav>
        </div>
        <button
          type="button"
          onClick={resetAllDemoData}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Reset all demo data
        </button>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
