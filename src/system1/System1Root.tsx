import { Outlet, useLocation } from 'react-router-dom'
import FadeContent from '../components/react-bits/FadeContent'

/**
 * System 1's routed shell. The sidebar this used to own moved into the top
 * navigation bar at the visual rebuild (searchlight-visual-spec.md: "top
 * navigation bar, not a sidebar"), so all that remains here is the
 * transition wrapper.
 *
 * FadeContent is keyed to the current path so it remounts — and re-triggers
 * its fade — on every navigation, not just on first load.
 */
export function System1Root() {
  const location = useLocation()
  return (
    <FadeContent key={location.pathname} duration={400} initialOpacity={0} className="min-h-0">
      <Outlet />
    </FadeContent>
  )
}
