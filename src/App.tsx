import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { System1Root } from './system1/System1Root'
import { Overview } from './system1/screens/Overview'
import { Population } from './system1/screens/Population'
import { IndividualDetail } from './system1/screens/IndividualDetail'
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
        </Route>
        <Route path="/system2" element={<System2Root />} />
        <Route path="*" element={<Navigate to="/system1" replace />} />
      </Routes>
    </AppShell>
  )
}
