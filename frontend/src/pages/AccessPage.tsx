import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { Alert, Card, DataSourceNote, Loading, PageHeader } from '../components/common'
import { Icon } from '../components/Icon'
import { ProviderMatchCard } from '../components/ProviderMatchCard'
import { isComplete } from '../lib/journey'
import { formatDate } from '../lib/format'

export function AccessPage() {
  const [params] = useSearchParams()
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  const open = journeys.data?.filter((j) => !isComplete(j)) ?? []
  const journey = open.find((j) => j.journey_id === params.get('journey')) ?? open.find((j) => j.stalled) ?? open[0]
  const journeyId = journey?.journey_id ?? ''
  const options = useApi(() => api.getProviderOptions(DEMO_PATIENT_ID, journeyId), `providers:${journeyId}`)
  // "Find better options" links from other screens arrive with the alternatives already open.
  const [expanded, setExpanded] = useState(params.get('show') === 'options')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!journeys.data) return <Loading label="Loading care needs…" />
  if (!journey) {
    return (
      <>
        <PageHeader eyebrow="Care access" title="No open care needs" lede="Every care pathway is complete." />
        <Link className="btn btn-primary" to="/journey">View care journey</Link>
      </>
    )
  }
  if (!options.data) return <Loading label="Finding reachable care options…" />

  const o = options.data
  const chosen = o.alternatives.find((a) => a.provider.provider_id === journey.provider_id)
  const showAlternatives = expanded || !!chosen

  const choose = async (providerId: string) => {
    setBusy(providerId)
    setError(null)
    try {
      await api.selectProvider(DEMO_PATIENT_ID, journeyId, providerId)
    } catch {
      setError('Could not book this provider. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Care access"
        title="Find care you can actually reach"
        lede="A referral only helps if the patient can get there. HERA weighs expertise, wait, distance, insurance, cost, telehealth and accessibility, and looks for another route when the first option doesn’t work."
        actions={<DataSourceNote source={options.source} />}
      />

      <Card icon="stethoscope" title={o.need} sub={`Referred ${formatDate(journey.state_history[0]?.entered_at ?? '', { year: true })} · ${journey.state_history[0]?.note ?? ''}`}>
        <div className="card-body stack">
          <div className="section-label">Original referral</div>
          <ProviderMatchCard match={o.original} variant="original" />
          {o.barriers.length > 0 && (
            <Alert
              tone="stalled"
              title="This option is hard to reach"
              action={
                !showAlternatives && (
                  <button type="button" className="btn btn-primary" onClick={() => setExpanded(true)}>
                    <Icon name="access" size={16} /> Find better options
                  </button>
                )
              }
            >
              {o.barriers.join(' · ')}
            </Alert>
          )}
        </div>
      </Card>

      {showAlternatives && (
        <section className="section-gap" aria-labelledby="alts-h">
          <div className="page-header" style={{ marginBottom: 12 }}>
            <div>
              <h2 id="alts-h" className="card-title" style={{ fontSize: 18 }}>
                HERA found {o.alternatives.length} better {o.alternatives.length === 1 ? 'option' : 'options'}
              </h2>
              <p className="card-sub">Ranked for this patient’s need, insurance, location and language</p>
            </div>
          </div>

          {chosen && (
            <div style={{ marginBottom: 16 }}>
              <Alert
                tone="good"
                title={`Booked with ${chosen.provider.name}${journey.appointment_date ? ` on ${formatDate(journey.appointment_date, { year: true })}` : ''}`}
                action={<Link className="btn btn-secondary btn-sm" to="/journey">View care journey</Link>}
              >
                Longitudinal records were shared with the new provider. HERA will keep tracking this referral until follow-up is complete.
              </Alert>
            </div>
          )}
          {error && <Alert tone="stalled" title={error} />}

          <div className="grid grid-2">
            {o.alternatives.map((m, i) => {
              const isChosen = m.provider.provider_id === chosen?.provider.provider_id
              return (
                <ProviderMatchCard
                  key={m.provider.provider_id}
                  match={m}
                  rank={i + 1}
                  compareTo={o.original}
                  action={
                    isChosen ? (
                      <span className="badge badge-good"><Icon name="check" size={12} /> Selected</span>
                    ) : (
                      <button type="button" className={`btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} disabled={!!chosen || busy !== null} onClick={() => choose(m.provider.provider_id)}>
                        {busy === m.provider.provider_id ? 'Booking…' : `Choose ${m.provider.name}`}
                      </button>
                    )
                  }
                />
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}
