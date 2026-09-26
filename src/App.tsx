import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { System1Root } from './system1/System1Root'
import { OverviewPopulation } from './system1/screens/OverviewPopulation'
import { IndividualDetail } from './system1/screens/IndividualDetail'
import { ExceptionsQueue } from './system1/screens/ExceptionsQueue'
import { MassAdjustment } from './system1/screens/MassAdjustment'
import { System2Root } from './system2/System2Root'
import { ExecutiveSummary } from './system2/screens/ExecutiveSummary'
import { DivisionComparison } from './system2/screens/DivisionComparison'
import { ScenarioWorkspace } from './system2/screens/ScenarioWorkspace'

export default function App() {
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
