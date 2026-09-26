import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { Alert, Card, DataSourceNote, Loading, PageHeader } from '../components/common'
import { Icon } from '../components/Icon'
import { ProviderMatchCard } from '../components/ProviderMatchCard'
import { isComplete } from '../lib/journey'
import { buildProviderOptions, journeyAppointmentDate, journeyProviderId, prettyReason, requiredSpecialty } from '../lib/providers'
import { formatDate, humanize } from '../lib/format'
import type { ProviderMatch } from '../types'

export function AccessPage() {
  const [params] = useSearchParams()
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  const specialty = record.data ? requiredSpecialty(record.data.events) : ''
  const matches = useApi(() => api.getProviderMatches(DEMO_PATIENT_ID, specialty), `providers:${specialty}`)
  // "Find better options" links from other screens arrive with the alternatives already open.
  const [expanded, setExpanded] = useState(params.get('show') === 'options')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!journeys.data || !record.data) return <Loading label="Loading care needs…" />
  const open = journeys.data.filter((j) => !isComplete(j))
  const journey = open.find((j) => j.journey_id === params.get('journey')) ?? open.find((j) => j.stalled) ?? open[0]
  if (!journey) {
    return (
      <>
        <PageHeader eyebrow="Care access" title="No open care needs" lede="Every care pathway is complete." />
        <Link className="btn btn-primary" to="/journey">View care journey</Link>
      </>
    )
  }
  if (!matches.data || !specialty) return <Loading label="Finding reachable care options…" />

  const r = record.data
  const o = buildProviderOptions(journey, matches.data, r.events)
  const currentId = journeyProviderId(journey, r.providers)
  const chosen = o.alternatives.find((a) => a.provider.provider_id === currentId)
  const appointment = journeyAppointmentDate(journey)
  const showAlternatives = expanded || !!chosen
  const plan = r.patient.insurance_plan
  const referral = journey.state_history[0]

  const choose = async (m: ProviderMatch) => {
    setBusy(m.provider.provider_id)
    setError(null)
    try {
      await api.selectProvider(DEMO_PATIENT_ID, journey.journey_id, m)
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
        actions={<DataSourceNote source={matches.source} />}
      />

      <Card
        icon="stethoscope"
        title={humanize(journey.need)}
        sub={referral ? `Care need identified ${formatDate(referral.entered_at, { year: true })}${referral.note ? ` · ${referral.note}` : ''}` : undefined}
      >
        <div className="card-body stack">
          {o.original ? (
            <>
              <div className="section-label">Original referral</div>
              <ProviderMatchCard match={o.original} insurancePlan={plan} variant="original" />
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
                  {o.barriers.map(prettyReason).join(' · ')}
                </Alert>
              )}
            </>
          ) : (
            !showAlternatives && (
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => setExpanded(true)}>
                  <Icon name="access" size={16} /> Find providers
                </button>
              </div>
            )
          )}
        </div>
      </Card>

      {showAlternatives && (
        <section className="section-gap" aria-labelledby="alts-h">
          <div style={{ marginBottom: 12 }}>
            <h2 id="alts-h" className="card-title" style={{ fontSize: 18 }}>
              {o.alternatives.length === 0
                ? 'No better options found yet'
                : `HERA found ${o.alternatives.length} better ${o.alternatives.length === 1 ? 'option' : 'options'}`}
            </h2>
            <p className="card-sub">Ranked for this patient’s need, insurance, location and language</p>
          </div>

          {chosen && (
            <div style={{ marginBottom: 16 }}>
              <Alert
                tone="good"
                title={`Booked with ${chosen.provider.name}${appointment ? ` on ${formatDate(appointment, { year: true })}` : ''}`}
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
                  insurancePlan={plan}
                  rank={i + 1}
                  compareTo={o.original}
                  action={
                    isChosen ? (
                      <span className="badge badge-good"><Icon name="check" size={12} /> Selected</span>
                    ) : (
                      <button type="button" className={`btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} disabled={!!chosen || busy !== null} onClick={() => choose(m)}>
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
