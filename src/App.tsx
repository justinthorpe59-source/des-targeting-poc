import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { System1Root } from './system1/System1Root'
import { Overview } from './system1/screens/Overview'
import { Population } from './system1/screens/Population'
import { IndividualDetail } from './system1/screens/IndividualDetail'
import { CohortComparison } from './system1/screens/CohortComparison'
import { WhatIfSandbox } from './system1/screens/WhatIfSandbox'
import { ManagerOverride } from './system1/screens/ManagerOverride'
import { ExceptionsQueue } from './system1/screens/ExceptionsQueue'
import { MassAdjustment } from './system1/screens/MassAdjustment'
import { EmployeeView } from './system1/screens/EmployeeView'
import { System2Root } from './system2/System2Root'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/system1" replace />} />
        <Route path="/system1" element={<System1Root />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="population" element={<Population />} />
          <Route path="person/:id" element={<IndividualDetail />} />
          <Route path="cohort" element={<CohortComparison />} />
          <Route path="cohort/:id" element={<CohortComparison />} />
          <Route path="whatif" element={<WhatIfSandbox />} />
          <Route path="whatif/:id" element={<WhatIfSandbox />} />
          <Route path="override" element={<ManagerOverride />} />
          <Route path="override/:id" element={<ManagerOverride />} />
          <Route path="exceptions" element={<ExceptionsQueue />} />
          <Route path="mass-adjustment" element={<MassAdjustment />} />
          <Route path="employee" element={<EmployeeView />} />
          <Route path="employee/:id" element={<EmployeeView />} />
        </Route>
        <Route path="/system2" element={<System2Root />} />
        <Route path="*" element={<Navigate to="/system1" replace />} />
      </Routes>
    </AppShell>
  )
}
