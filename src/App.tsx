import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { System1Root } from './system1/System1Root'
import { ScreenA } from './system1/screens/ScreenA'
import { ScreenB } from './system1/screens/ScreenB'
import { System2Root } from './system2/System2Root'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/system1" replace />} />
        <Route path="/system1" element={<System1Root />}>
          <Route index element={<Navigate to="a" replace />} />
          <Route path="a" element={<ScreenA />} />
          <Route path="b" element={<ScreenB />} />
        </Route>
        <Route path="/system2" element={<System2Root />} />
        <Route path="*" element={<Navigate to="/system1" replace />} />
      </Routes>
    </AppShell>
  )
}
