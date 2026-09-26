import { Route, Routes } from 'react-router-dom'
import { api, DEMO_PATIENT_ID } from './api/client'
import { useApi } from './api/useApi'
import { Layout } from './components/Layout'
import { attentionItems } from './lib/attention'
import { HomePage } from './pages/HomePage'
import { RecordPage } from './pages/RecordPage'
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  const stalledCount = attentionItems(journeys.data ?? []).filter((a) => a.tone === 'stalled').length

  return (
    <Routes>
      <Route element={<Layout attentionCount={stalledCount} />}>
        <Route index element={<HomePage />} />
        <Route path="record" element={<RecordPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
