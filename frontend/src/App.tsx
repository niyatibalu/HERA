import { Navigate, Route, Routes } from 'react-router-dom'
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
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  const mychart = useApi(() => api.getMyChart(DEMO_PATIENT_ID), 'mychart')
  const stalledCount = attentionItems(journeys.data ?? [], DEMO_TODAY).filter((a) => a.tone === 'stalled').length

  return (
    <Routes>
      <Route element={<Layout patient={record.data?.patient} mychart={mychart.data} attentionCount={stalledCount} />}>
        <Route index element={<HomePage />} />
        <Route path="record" element={<RecordPage />} />
        <Route path="symptoms" element={<SymptomLogPage />} />
        <Route path="timeline" element={<Navigate to="/symptoms" replace />} />
        <Route path="access" element={<AccessPage />} />
        <Route path="journey" element={<JourneyPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="research" element={<ResearchPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
