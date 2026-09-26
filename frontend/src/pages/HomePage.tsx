import { Link } from 'react-router-dom'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { Alert, Card, CardLink, DataSourceNote, Loading, PageHeader } from '../components/common'
import { Icon } from '../components/Icon'
import { TrendFlag } from '../components/TrendFlag'
import { attentionItems, isComplete, journeySteps } from '../lib/journey'
import { careTeam, groupEvents, providerLookup } from '../lib/record'
import { journeyAppointmentDate, journeyProviderId } from '../lib/providers'
import { daysBetween, formatDate, formatMonth, humanize, specialtyLabel } from '../lib/format'
import { DEMO_TODAY } from '../mocks/record'

export function HomePage() {
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const flags = useApi(() => api.getFlags(DEMO_PATIENT_ID), 'flags')
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')

  if (!record.data || !flags.data || !journeys.data) return <Loading label="Loading your care overview…" />

  const r = record.data
  const provider = providerLookup(r.providers)
  const g = groupEvents(r.events)
  const attention = attentionItems(journeys.data, DEMO_TODAY)
  const firstName = r.patient.name.split(' ')[0]
  const active = journeys.data.filter((j) => !isComplete(j))
  const providerOf = (j: (typeof journeys.data)[number]) => provider(journeyProviderId(j, r.providers))
  const upcoming = journeys.data
    .map((j) => ({ j, date: journeyAppointmentDate(j) }))
    .filter((x): x is { j: (typeof x)['j']; date: string } => !!x.date && x.date >= DEMO_TODAY)
    .sort((a, b) => a.date.localeCompare(b.date))
  const openReferrals = g.referral.filter((x) => x.status !== 'completed')
  const recent = r.events.filter((e) => e.event_type !== 'diagnosis').sort((a, b) => b.event_date.localeCompare(a.event_date)).slice(0, 5)
  const flagged = new Set(flags.data.flatMap((f) => f.evidence.map((e) => e.event_id)))
  const topFlag = flags.data[0]
  const firstVisit = g.encounter[g.encounter.length - 1]
  const team = careTeam(r)

  return (
    <>
      <PageHeader
        eyebrow="HERA overview"
        title={`Welcome back, ${firstName}`}
        lede={
          <>
            HERA has connected <strong>{g.encounter.length} visits</strong> with <strong>{team.length} clinicians</strong>
            {firstVisit && <> since {formatDate(firstVisit.event_date, { year: true })}</>} into one health story, so nothing gets lost between appointments.
          </>
        }
        actions={<DataSourceNote source={record.source} />}
      />

      {attention.length > 0 && (
        <section aria-labelledby="attention-h" className="stack-sm" style={{ marginBottom: 24 }}>
          <h2 id="attention-h" className="section-label">Needs attention</h2>
          {attention.map((a) => (
            <Alert key={a.id} tone={a.tone} title={a.title} action={<Link className="btn btn-secondary btn-sm" to={a.action.to}>{a.action.label}</Link>}>
              {a.detail}
            </Alert>
          ))}
        </section>
      )}

      <div className="grid grid-main">
        <div className="stack">
          <Card icon="journey" title="Active care" sub={`${active.length} care ${active.length === 1 ? 'need' : 'needs'} in progress`} action={<CardLink to="/journey">Care journey</CardLink>}>
            {active.length === 0 ? (
              <div className="empty">All care pathways are complete.</div>
            ) : (
              <ul className="list">
                {active.map((j) => {
                  const steps = journeySteps(j)
                  const done = steps.filter((s) => s.status === 'complete').length
                  const p = providerOf(j)
                  return (
                    <li key={j.journey_id}>
                      <div className="list-main">
                        <div className="list-title">{humanize(j.need)}</div>
                        <div className="list-meta">
                          {p ? `${p.name} · ` : ''}started {formatDate(j.state_history[0]?.entered_at ?? DEMO_TODAY)}
                        </div>
                        <div className="progress" aria-label={`${done} of ${steps.length} steps complete`}>
                          {steps.map((s) => <span key={s.state} className={`progress-seg is-${s.status}`} />)}
                        </div>
                      </div>
                      <div className="list-aside">
                        {j.stalled ? (
                          <span className="badge badge-stalled"><Icon name="pause" size={12} /> Stalled</span>
                        ) : (
                          <span className="badge badge-accent num">{done}/{steps.length} steps</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card icon="clock" title="Recent health changes" sub="From all connected records" action={<CardLink to="/timeline">Full timeline</CardLink>}>
            <ul className="list">
              {recent.map((e) => {
                const m = formatMonth(e.event_date)
                return (
                  <li key={e.event_id}>
                    <span className="date-chip num"><span>{m.month}</span>{m.day}</span>
                    <div className="list-main">
                      <div className="list-title">{e.description}</div>
                      <div className="list-meta">{specialtyLabel(e.specialty)}{provider(e.provider_id) ? ` · ${provider(e.provider_id)!.name}` : ''}</div>
                    </div>
                    {flagged.has(e.event_id) && (
                      <span className="flag-dot" title="Part of a pattern flagged for clinician review">
                        <Icon name="flag" size={14} />
                        <span className="visually-hidden">Flagged for clinician review</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>

        <div className="stack">
          <Card icon="calendar" title="Upcoming" action={<CardLink to="/journey">All</CardLink>}>
            {upcoming.length === 0 ? (
              <div className="empty stack-sm" style={{ alignItems: 'center' }}>
                <span>No specialist visit booked yet.</span>
                <Link to="/access" className="btn btn-primary btn-sm">Find care options</Link>
              </div>
            ) : (
              <ul className="list">
                {upcoming.map(({ j, date }) => {
                  const m = formatMonth(date)
                  return (
                    <li key={j.journey_id}>
                      <span className="date-chip date-chip-accent num"><span>{m.month}</span>{m.day}</span>
                      <div className="list-main">
                        <div className="list-title">{humanize(j.need)}</div>
                        <div className="list-meta">{providerOf(j)?.name}</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {topFlag && (
            <Card icon="flag" title="Health trend" sub="Pattern across your connected records" action={<CardLink to="/timeline">Details</CardLink>}>
              <div className="card-body">
                <TrendFlag flag={topFlag} compact />
              </div>
            </Card>
          )}

          <Card icon="arrow" title="Active referrals">
            {openReferrals.length === 0 ? (
              <div className="empty">No open referrals</div>
            ) : (
              <ul className="list">
                {openReferrals.map((x) => (
                  <li key={x.event_id}>
                    <div className="list-main">
                      <div className="list-title">{specialtyLabel(x.specialty)}</div>
                      <div className="list-meta">Placed {formatDate(x.event_date)} by {provider(x.provider_id)?.name ?? 'care team'}</div>
                    </div>
                    <span className="badge badge-review num">Open {daysBetween(x.event_date, DEMO_TODAY)}d</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
