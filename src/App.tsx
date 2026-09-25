import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { System1Root } from './system1/System1Root'
import { OverviewPopulation } from './system1/screens/OverviewPopulation'
import { IndividualDetail } from './system1/screens/IndividualDetail'
import { ManagerOverride } from './system1/screens/ManagerOverride'
import { ExceptionsQueue } from './system1/screens/ExceptionsQueue'
import { MassAdjustment } from './system1/screens/MassAdjustment'
import { System2Root } from './system2/System2Root'
import { ExecutiveSummary } from './system2/screens/ExecutiveSummary'
import { DivisionComparison } from './system2/screens/DivisionComparison'
import { TeamDrillDown } from './system2/screens/TeamDrillDown'
import { ScenarioWorkspace } from './system2/screens/ScenarioWorkspace'
import { ScenarioLibrary } from './system2/screens/ScenarioLibrary'
import { RiskExceptions } from './system2/screens/RiskExceptions'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/system1" replace />} />
        <Route path="/system1" element={<System1Root />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPopulation />} />
          <Route path="person/:id" element={<IndividualDetail />} />
          <Route path="override" element={<ManagerOverride />} />
          <Route path="override/:id" element={<ManagerOverride />} />
          <Route path="exceptions" element={<ExceptionsQueue />} />
          <Route path="mass-adjustment" element={<MassAdjustment />} />
        </Route>
        <Route path="/system2" element={<System2Root />}>
          <Route index element={<Navigate to="executive-summary" replace />} />
          <Route path="executive-summary" element={<ExecutiveSummary />} />
          <Route path="division-comparison" element={<DivisionComparison />} />
          <Route path="team-drilldown" element={<TeamDrillDown />} />
          <Route path="scenario-workspace" element={<ScenarioWorkspace />} />
          <Route path="scenario-library" element={<ScenarioLibrary />} />
          <Route path="exceptions" element={<RiskExceptions />} />
        </Route>
        <Route path="*" element={<Navigate to="/system1" replace />} />
      </Routes>
    </AppShell>
  )
}
