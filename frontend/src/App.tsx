import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { api, DEMO_PATIENT_ID } from './api/client'
import { useApi } from './api/useApi'
import { Layout } from './components/Layout'
import { attentionItems } from './lib/journey'
import { DEMO_TODAY } from './mocks/record'
import { HomePage } from './pages/HomePage'
import { RecordPage } from './pages/RecordPage'
import { SymptomLogPage } from './pages/SymptomLogPage'
import { AccessPage } from './pages/AccessPage'
import { JourneyPage } from './pages/JourneyPage'
import { ResearchPage } from './pages/ResearchPage'
import { MapPage } from './pages/MapPage'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { LoginPage } from './pages/LoginPage'
import { currentSession, onSessionChange } from './lib/auth'
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="*" element={<RequireAuth><SignedInApp /></RequireAuth>} />
    </Routes>
  )
}

/** Sends signed-out visitors to /login, then back to where they were going. */
function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [session, setSession] = useState(currentSession)
  useEffect(() => onSessionChange(() => setSession(currentSession())), [])
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}

function SignedInApp() {
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  const mychart = useApi(() => api.getMyChart(DEMO_PATIENT_ID), 'mychart')
  const stalledCount = attentionItems(journeys.data ?? [], DEMO_TODAY).filter((a) => a.tone === 'stalled').length

  return (
    <Routes>
      <Route element={<Layout patient={record.data?.patient} mychart={mychart.data} attentionCount={stalledCount} />}>
        <Route index element={<HomePage />} />
        <Route path="record" element={<RecordPage />} />
        <Route path="timeline" element={<SymptomLogPage />} />
        <Route path="symptoms" element={<Navigate to="/timeline" replace />} />
        <Route path="care" element={<Navigate to="/access" replace />} />
        <Route path="access" element={<AccessPage />} />
        <Route path="journey" element={<JourneyPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="research" element={<ResearchPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
