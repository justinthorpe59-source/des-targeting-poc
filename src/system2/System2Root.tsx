import { Outlet, useLocation } from 'react-router-dom'
import FadeContent from '../components/react-bits/FadeContent'

/**
 * System 2's routed shell — mirrors System1Root exactly. Its sidebar moved
 * into the top navigation bar at the visual rebuild; only the per-navigation
 * transition wrapper remains.
 */
export function System2Root() {
  const location = useLocation()
  return (
    <FadeContent key={location.pathname} duration={400} initialOpacity={0} className="min-h-0">
      <Outlet />
    </FadeContent>
  )
}
