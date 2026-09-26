import { Link } from 'react-router-dom'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { DataSourceNote, Loading } from '../components/common'
import { Icon } from '../components/Icon'
import { attentionItems, isComplete, journeySteps } from '../lib/journey'
import { providerLookup } from '../lib/record'
import { journeyAppointmentDate, journeyProviderId } from '../lib/providers'
import { daysBetween, formatDate, humanize } from '../lib/format'
import { DEMO_TODAY } from '../mocks/record'
import type { CareState, SymptomLogEntry } from '../types'

const SHORT_STEP: Partial<Record<CareState, string>> = {
  need_identified: 'Referral',
  provider_matched: 'Provider',
  records_ready: 'Records',
  appointment_scheduled: 'Appointment',
  travel_planned: 'Travel',
  appointment_completed: 'Visit',
  followup_completed: 'Follow-up',
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function HomePage() {
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')
  const mychart = useApi(() => api.getMyChart(DEMO_PATIENT_ID), 'mychart')
  const symptoms = useApi(() => api.getSymptomLog(DEMO_PATIENT_ID), 'symptom-log')

  if (!record.data || !journeys.data || !mychart.data || !symptoms.data) return <Loading label="Loading your care overview…" />

  const r = record.data
  const provider = providerLookup(r.providers)
  const firstName = r.patient.name.split(' ')[0]
  const attention = attentionItems(journeys.data, DEMO_TODAY)
  const priority = attention[0]
  const journey = journeys.data.find((j) => !isComplete(j))
  const upcoming = journeys.data
    .map((j) => ({ j, date: journeyAppointmentDate(j) }))
    .filter((x): x is { j: (typeof x)['j']; date: string } => !!x.date && x.date >= DEMO_TODAY)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const connected = mychart.data.status === 'connected'
  const latestChange = r.events
    .filter((e) => e.event_type !== 'diagnosis' && e.event_type !== 'symptom')
    .sort((a, b) => b.event_date.localeCompare(a.event_date))[0]
  const latestNote = symptoms.data[0]
  const bySymptom = latestPerSymptom(symptoms.data).slice(0, 3)

  return (
    <div className="home">
      <header className="home-head">
        <div>
          <h1 className="page-title">{greeting()}, {firstName}</h1>
          <p className="home-sub">
            {attention.length === 0 ? "You're all caught up." : `${attention.length} ${attention.length === 1 ? 'thing needs' : 'things need'} your attention`}
          </p>
        </div>
        <DataSourceNote source={record.source} />
      </header>

      {priority ? (
        <section className={`priority is-${priority.tone}`} aria-labelledby="priority-h">
          <span className="priority-icon" aria-hidden="true"><Icon name={priority.tone === 'stalled' ? 'pause' : 'clock'} size={22} /></span>
          <div className="priority-text">
            <h2 id="priority-h">{priority.headline}</h2>
            <p>{priority.summary}</p>
          </div>
          <Link className="btn btn-primary btn-lg" to={priority.action.to}>{priority.action.label}</Link>
        </section>
      ) : (
        <section className="priority is-good" aria-label="Nothing needs attention">
          <span className="priority-icon" aria-hidden="true"><Icon name="check" size={22} /></span>
          <div className="priority-text">
            <h2>Everything is on track</h2>
            <p>HERA will let you know if a referral or appointment stalls.</p>
          </div>
        </section>
      )}

      <div className="home-grid">
        <div className="home-main">
          {journey && <JourneyCard journey={journey} providerName={provider(journeyProviderId(journey, r.providers))?.name} />}

          <div className="insights">
            {latestNote ? (
              <article className="panel insight" aria-labelledby="note-h">
                <div className="insight-kicker">Your latest note</div>
                <h2 id="note-h" className="panel-title">{latestNote.symptom} · {latestNote.severity}/10</h2>
                <p className="panel-text clamp-2">{latestNote.note || 'No note added.'}</p>
                <Link to="/timeline" className="text-link">View timeline <Icon name="arrow" size={16} /></Link>
              </article>
            ) : null}
            {connected && latestChange ? (
              <article className="panel insight" aria-labelledby="change-h">
                <div className="insight-kicker">Latest change · {formatDate(latestChange.event_date)}</div>
                <h2 id="change-h" className="panel-title clamp-2">{latestChange.description}</h2>
                <p className="panel-text">From {provider(latestChange.provider_id)?.name ?? 'your care team'}</p>
                <Link to="/record" className="text-link">View record <Icon name="arrow" size={16} /></Link>
              </article>
            ) : (
              <article className="panel insight insight-connect" aria-labelledby="connect-h">
                <div className="insight-kicker">Records</div>
                <h2 id="connect-h" className="panel-title">Bring your records together</h2>
                <p className="panel-text">Connect MyChart so every clinician sees the whole story.</p>
                <Link to="/record" className="btn btn-secondary">Connect MyChart</Link>
              </article>
            )}
          </div>
        </div>

        <aside className="home-side">
          <section className="panel" aria-labelledby="upcoming-h">
            <h2 id="upcoming-h" className="panel-label">Upcoming care</h2>
            {upcoming ? (
              <div className="upcoming">
                <div className="date-tile num" aria-hidden="true">
                  <span>{formatDate(upcoming.date).split(' ')[0]}</span>
                  {formatDate(upcoming.date).split(' ')[1]}
                </div>
                <div>
                  <div className="panel-title">{provider(journeyProviderId(upcoming.j, r.providers))?.name ?? 'Specialist visit'}</div>
                  <p className="panel-text">{humanize(upcoming.j.need)}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="panel-title">No specialist appointment yet</div>
                <p className="panel-text">Find a provider that works for you.</p>
                <Link to="/access" className="btn btn-secondary">Find care</Link>
              </>
            )}
          </section>

          <section className="panel" aria-labelledby="symptoms-h">
            <div className="panel-row">
              <h2 id="symptoms-h" className="panel-label">Symptoms</h2>
              <Link to="/timeline" className="text-link">Log <Icon name="arrow" size={16} /></Link>
            </div>
            {bySymptom.length === 0 ? (
              <p className="panel-text">No symptoms logged yet.</p>
            ) : (
              <ul className="symptom-chips">
                {bySymptom.map((e) => (
                  <li key={e.entry_id} className="symptom-chip">
                    <span className="symptom-chip-name">{e.symptom}</span>
                    <span className={`symptom-chip-score num ${e.severity >= 7 ? 'is-high' : ''}`}>{e.severity}<small>/10</small></span>
                    <span className="symptom-chip-meta">{loggedAgo(e.logged_on)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function JourneyCard({ journey, providerName }: { journey: Parameters<typeof journeySteps>[0]; providerName?: string }) {
  const steps = journeySteps(journey)
  const done = steps.filter((s) => s.status === 'complete').length
  const need = humanize(journey.need).replace(/ (evaluation|specialist evaluation)$/i, '')
  return (
    <section className="panel journey-card" aria-labelledby="journey-h">
      <div className="panel-row">
        <div>
          <h2 id="journey-h" className="panel-title-lg">{need} care journey</h2>
          <p className="panel-text">
            {done} of {steps.length} steps complete{providerName ? ` · ${providerName}` : ''}
          </p>
        </div>
        <Link to="/journey" className="btn btn-secondary">View journey</Link>
      </div>
      <ol className="mini-steps" aria-label={`${done} of ${steps.length} steps complete`}>
        {steps.map((s) => (
          <li key={s.state} className={`mini-step is-${s.status}`}>
            <span className="mini-step-bar" />
            <span className="mini-step-label">{SHORT_STEP[s.state] ?? s.label}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function latestPerSymptom(entries: SymptomLogEntry[]) {
  const seen = new Map<string, SymptomLogEntry>()
  for (const e of entries) {
    const k = e.symptom.toLowerCase()
    if (!seen.has(k)) seen.set(k, e) // entries arrive newest first
  }
  return [...seen.values()]
}

function loggedAgo(date: string) {
  const d = daysBetween(date, DEMO_TODAY)
  return d <= 0 ? 'Logged today' : d === 1 ? 'Logged yesterday' : d < 30 ? `Logged ${d} days ago` : `Logged ${formatDate(date)}`
}
