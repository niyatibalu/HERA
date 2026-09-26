import { Route, Routes } from 'react-router-dom'
import { api, DEMO_PATIENT_ID } from './api/client'
import { useApi } from './api/useApi'
import { Layout } from './components/Layout'
import { attentionItems } from './lib/journey'
import { DEMO_TODAY } from './mocks/record'
import { HomePage } from './pages/HomePage'
import { RecordPage } from './pages/RecordPage'
import { TimelinePage } from './pages/TimelinePage'
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  const stalledCount = attentionItems(journeys.data ?? [], DEMO_TODAY).filter((a) => a.tone === 'stalled').length

  return (
    <Routes>
      <Route element={<Layout patient={record.data?.patient} sourceCount={record.data?.record_sources?.length} attentionCount={stalledCount} />}>
        <Route index element={<HomePage />} />
        <Route path="record" element={<RecordPage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
