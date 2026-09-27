import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { Alert, DataSourceNote, Loading, PageHeader } from '../components/common'
import { Icon } from '../components/Icon'
import { CareTabs } from '../components/Layout'
import { journeyAppointmentDate, journeyProviderId } from '../lib/providers'
import { providerLookup } from '../lib/record'
import { formatDay, formatTime, modalityLabel } from '../lib/scheduling'
import { humanize, specialtyLabel } from '../lib/format'
import type { CareJourney, Provider } from '../types'

const REASONS = ['Schedule conflict', 'Found another provider', 'Feeling better', 'Transportation problem', 'Other']

export function AppointmentsPage() {
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const [cancelled, setCancelled] = useState<{ journeyId: string; name: string } | null>(null)
  if (!journeys.data || !record.data) return <Loading label="Loading your appointments…" />

  const provider = providerLookup(record.data.providers)
  const booked = journeys.data
    .map((j) => ({ j, date: journeyAppointmentDate(j), p: provider(journeyProviderId(j, record.data!.providers)) }))
    .filter((x): x is { j: CareJourney; date: string; p: Provider | undefined } => !!x.date && x.j.state !== 'followup_completed' && x.j.state !== 'appointment_completed')
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <>
      <CareTabs />
      <PageHeader eyebrow="Appointments" title="Your appointments" lede="See what's coming up, and reschedule or cancel if plans change." actions={<DataSourceNote source={journeys.source} />} />

      {cancelled && (
        <div style={{ marginBottom: 24 }}>
          <Alert tone="info" title={`Appointment with ${cancelled.name} cancelled`} action={<Link className="btn btn-primary" to={`/access?journey=${cancelled.journeyId}&show=options`}>Find a new time</Link>}>
            Your care journey is still open, so HERA will keep tracking this referral.
          </Alert>
        </div>
      )}

      {booked.length === 0 ? (
        <section className="panel" aria-label="No upcoming appointments">
          <div className="panel-title">No upcoming appointments</div>
          <p className="panel-text">Find a provider that works for you and book a time.</p>
          <Link to="/access" className="btn btn-primary">Find care</Link>
        </section>
      ) : (
        <div className="stack">
          {booked.map(({ j, date, p }) => (
            <AppointmentCard key={j.journey_id} journey={j} date={date} provider={p} onCancelled={() => setCancelled({ journeyId: j.journey_id, name: p?.name ?? 'your provider' })} />
          ))}
        </div>
      )}
    </>
  )
}

function AppointmentCard({ journey: j, date, provider: p, onCancelled }: { journey: CareJourney; date: string; provider?: Provider; onCancelled: () => void }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const video = j.appointment_modality === 'telehealth'
  const when = `${formatDay(date)}${j.appointment_time ? ` at ${formatTime(j.appointment_time)}` : ''}`
  const [, mon, day] = formatDay(date).split(/[ ,]+/)

  const cancel = async (thenRebook = false) => {
    setBusy(true)
    setError(null)
    try {
      await api.cancelAppointment(DEMO_PATIENT_ID, j.journey_id, thenRebook ? 'Rescheduled' : reason)
      if (thenRebook) navigate(`/access?journey=${j.journey_id}&show=options&book=${p?.provider_id ?? ''}`)
      else onCancelled()
    } catch {
      setError('Could not update this appointment. Please try again.')
      setBusy(false)
    }
  }

  return (
    <article className="card appointment" aria-label={`Appointment with ${p?.name ?? 'provider'} on ${when}`}>
      <div className="card-body appointment-body">
        <div className="date-tile num" aria-hidden="true"><span>{mon}</span>{day}</div>
        <div className="appointment-main">
          <h2 className="panel-title-lg">{when}</h2>
          <p className="panel-text">{p?.name ?? 'Provider'} · {specialtyLabel(p?.specialty)}</p>
          <dl className="appointment-facts">
            <div><dt>Visit</dt><dd><Icon name={video ? 'video' : 'access'} size={16} /> {modalityLabel(j.appointment_modality)}</dd></div>
            <div><dt>{video ? 'Link' : 'Where'}</dt><dd>{video ? 'Sent by the clinic before your visit' : p?.location.address}</dd></div>
            <div><dt>For</dt><dd>{humanize(j.need)}</dd></div>
          </dl>
        </div>
      </div>

      {confirming ? (
        <div className="appointment-confirm" role="group" aria-label="Confirm cancellation">
          <div className="panel-title">Cancel your appointment on {when}?</div>
          <label className="field">
            <span className="field-label">Reason (optional)</span>
            <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="row">
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => cancel()}>{busy ? 'Cancelling…' : 'Yes, cancel appointment'}</button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setConfirming(false)}>Keep appointment</button>
          </div>
        </div>
      ) : (
        <div className="appointment-actions row">
          {!video && <Link className="btn btn-primary" to="/journey">Plan your trip</Link>}
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => cancel(true)}>Reschedule</button>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)}>Cancel appointment</button>
          {error && <p className="error-text" role="alert">{error}</p>}
        </div>
      )}
    </article>
  )
}
