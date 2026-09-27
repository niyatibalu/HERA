import { useState } from 'react'
import { CareTabs } from '../components/Layout'
import { Link, useSearchParams } from 'react-router-dom'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { Alert, Card, DataSourceNote, Loading, PageHeader } from '../components/common'
import { Icon } from '../components/Icon'
import { PreferencesPanel } from '../components/PreferencesPanel'
import { ProviderMatchCard } from '../components/ProviderMatchCard'
import { Scheduler } from '../components/Scheduler'
import { formatDay, formatTime, modalityLabel, type Booking } from '../lib/scheduling'
import { isComplete } from '../lib/journey'
import { buildProviderOptions, journeyAppointmentDate, journeyProviderId, prettyReason, requiredSpecialty } from '../lib/providers'
import { formatDate, humanize } from '../lib/format'
import type { ProviderMatch } from '../types'

const TOP = 3

export function AccessPage() {
  const [params] = useSearchParams()
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  const specialty = record.data ? requiredSpecialty(record.data.events) : ''
  const matches = useApi(() => api.getProviderMatches(DEMO_PATIENT_ID, specialty), `providers:${specialty}`)
  // "Find better options" links from other screens arrive with the alternatives already open.
  const [expanded, setExpanded] = useState(params.get('show') === 'options')
  const [busy, setBusy] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [scheduling, setScheduling] = useState<ProviderMatch | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!journeys.data || !record.data) return <Loading label="Loading care needs…" />
  const open = journeys.data.filter((j) => !isComplete(j))
  const journey = open.find((j) => j.journey_id === params.get('journey')) ?? open.find((j) => j.stalled) ?? open[0]
  if (!journey) {
    return (
      <>
        <CareTabs />
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

  const choose = (m: ProviderMatch) => {
    setError(null)
    setScheduling(m)
    requestAnimationFrame(() => document.getElementById('schedule-h')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const book = async (m: ProviderMatch, b: Booking) => {
    setBusy(m.provider.provider_id)
    setError(null)
    try {
      await api.selectProvider(DEMO_PATIENT_ID, journey.journey_id, m, b)
      setScheduling(null)
    } catch {
      setError('Could not book this appointment. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <CareTabs />
      <PageHeader
        eyebrow="Care access"
        title="Find care you can actually reach"
        lede="Providers ranked by what matters to you, and ones you can actually reach."
        actions={<DataSourceNote source={matches.source} />}
      />

      <PreferencesPanel planOnFile={plan} home={r.patient.home_location.address} />

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
                  {o.barriers.slice(0, 3).map(prettyReason).join(' · ')}{o.barriers.length > 3 ? ` · +${o.barriers.length - 3} more` : ''}
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
          <div style={{ marginBottom: 20 }}>
            <h2 id="alts-h" className="section-title">
              {o.alternatives.length === 0
                ? 'No better options found yet'
                : `Top ${Math.min(TOP, o.alternatives.length)} of ${o.alternatives.length} better ${o.alternatives.length === 1 ? 'option' : 'options'}`}
            </h2>
            <p className="card-sub">Ranked by your care preferences. Change them above and the ranking updates.</p>
          </div>

          {chosen && (
            <div style={{ marginBottom: 24 }}>
              <Alert
                tone="good"
                title={`You're booked with ${chosen.provider.name}`}
                action={
                  <Link className="btn btn-primary" to="/journey">
                    {journey.appointment_modality === 'telehealth' ? 'Next: view your journey' : 'Next: plan your trip'} <Icon name="arrow" size={16} />
                  </Link>
                }
              >
                {appointment ? formatDay(appointment) : ''}
                {journey.appointment_time ? ` at ${formatTime(journey.appointment_time)}` : ''}
                {journey.appointment_modality ? ` · ${modalityLabel(journey.appointment_modality)}` : ''}. Your records were shared with the new provider.
              </Alert>
            </div>
          )}
          {scheduling && !chosen && (
            <div style={{ marginBottom: 24 }}>
              <Scheduler match={scheduling} busy={busy !== null} onConfirm={(b) => book(scheduling, b)} onCancel={() => setScheduling(null)} />
            </div>
          )}
          {error && <Alert tone="stalled" title={error} />}

          <div className="grid grid-2">
            {o.alternatives.filter((m, i) => showAll || i < TOP || m.provider.provider_id === chosen?.provider.provider_id).map((m, i) => {
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
                      <button type="button" className={`btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} disabled={!!chosen || busy !== null} onClick={() => choose(m)} aria-pressed={scheduling?.provider.provider_id === m.provider.provider_id}>
                        {`Choose ${m.provider.name}`}
                      </button>
                    )
                  }
                />
              )
            })}
          </div>
          {o.alternatives.length > TOP && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                {showAll ? 'Show fewer options' : `Show ${o.alternatives.length - TOP} more ${o.alternatives.length - TOP === 1 ? 'option' : 'options'}`}
              </button>
            </div>
          )}
        </section>
      )}
    </>
  )
}
