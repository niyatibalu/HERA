import { Link } from 'react-router-dom'
import { CareTabs } from '../components/Layout'
import { api, DEMO_PATIENT_ID, MAP_URL } from '../api/client'
import { useApi } from '../api/useApi'
import { AccessMapFrame } from '../components/AccessMapFrame'
import { Alert, Loading, PageHeader } from '../components/common'
import { isComplete } from '../lib/journey'
import { journeyProviderId } from '../lib/providers'

/** The full interactive access map: providers, route scoring, travel conditions and regional care gaps. */
export function MapPage() {
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  const prefs = useApi(() => api.getPreferences(DEMO_PATIENT_ID), 'preferences')
  if (!record.data || !journeys.data) return <Loading label="Loading access map…" />

  // Open the map on the provider the patient is currently heading to, if there is one.
  const open = journeys.data.find((j) => !isComplete(j))
  const providerId = open ? journeyProviderId(open, record.data.providers) : undefined

  return (
    <>
      <CareTabs />
      <PageHeader
        eyebrow="Access map"
        title="Reaching care, not just finding it"
        lede="Routes ranked by travel time, weather, road conditions and nearby care. Recommendations, not guarantees."
        actions={<Link className="btn btn-secondary btn-sm" to="/journey">Back to care journey</Link>}
      />
      <MapOrNotice providerId={providerId} pregnant={!!prefs.data?.pregnant} />
    </>
  )
}

function MapOrNotice({ providerId, pregnant }: { providerId?: string; pregnant: boolean }) {
  const notice = (
    <Alert tone="review" title="Access map service not connected">
      Start it with <code>cd map &amp;&amp; python3 -m hera_map.server</code>{!MAP_URL && <> and set <code>VITE_HERA_MAP_URL=http://127.0.0.1:8001</code></>}. Route options still appear on the care journey.
    </Alert>
  )
  return <AccessMapFrame patientId={DEMO_PATIENT_ID} providerId={providerId} mode="full" height="min(76vh, 820px)" title="HERA access map" fallback={notice} pregnant={pregnant} key={String(pregnant)} />
}
