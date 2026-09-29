import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { SplashScreen } from './components/searchlight/SplashScreen'
import { System1Root } from './system1/System1Root'
import { OverviewPopulation } from './system1/screens/OverviewPopulation'
import { IndividualDetail } from './system1/screens/IndividualDetail'
import { ExceptionsQueue } from './system1/screens/ExceptionsQueue'
import { MassAdjustment } from './system1/screens/MassAdjustment'
import { System2Root } from './system2/System2Root'
import { ExecutiveSummary } from './system2/screens/ExecutiveSummary'
import { DivisionComparison } from './system2/screens/DivisionComparison'
import { ScenarioWorkspace } from './system2/screens/ScenarioWorkspace'

/**
 * Once per browsing session, not once per page load. sessionStorage is
 * exactly that boundary: it survives a refresh and internal navigation in
 * the same tab, and starts empty in a new tab or window — so the splash
 * greets a freshly-opened POC and then stays out of the way.
 *
 * It is also untouched by "Reset demo data", which clears the four zustand
 * stores and nothing else. A reset mid-demo puts the data back without
 * throwing the presenter out to the splash.
 *
 * Wrapped because a browser with site data blocked throws on access, and a
 * splash is not worth a blank application over. If it throws, the splash
 * simply shows each load.
 */
const SPLASH_KEY = 'searchlight:splash-seen'

function splashAlreadySeen(): boolean {
  try {
    return window.sessionStorage.getItem(SPLASH_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberSplashSeen(): void {
  try {
    window.sessionStorage.setItem(SPLASH_KEY, 'true')
  } catch {
    /* Ignored — see above. */
  }
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => !splashAlreadySeen())

  /* Returned instead of the shell, not layered over it: the app behind is
     not interactive yet, and mounting both would run every screen's
     entrance animation while it is hidden. */
  if (showSplash) {
    return (
      <SplashScreen
        onEnter={() => {
          rememberSplashSeen()
          setShowSplash(false)
        }}
      />
    )
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/system1" replace />} />
        <Route path="/system1" element={<System1Root />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPopulation />} />
          <Route path="person/:id" element={<IndividualDetail />} />
          {/* Manager Override is a modal over Individual Detail, not a screen
              of its own. This route still resolves so deep links keep working:
              it renders Individual Detail with the modal already open. The
              person-less /override route is gone — an override with no subject
              has nothing to show. */}
          <Route path="override/:id" element={<IndividualDetail />} />
          <Route path="exceptions" element={<ExceptionsQueue />} />
          <Route path="mass-adjustment" element={<MassAdjustment />} />
        </Route>
        <Route path="/system2" element={<System2Root />}>
          <Route index element={<Navigate to="executive-summary" replace />} />
          <Route path="executive-summary" element={<ExecutiveSummary />} />
          <Route path="division-comparison" element={<DivisionComparison />} />
          <Route path="scenario-workspace" element={<ScenarioWorkspace />} />
        </Route>
        <Route path="*" element={<Navigate to="/system1" replace />} />
      </Routes>
    </AppShell>
  )
}
