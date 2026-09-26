import { Link } from 'react-router-dom'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { Alert, Card, CardLink, DataSourceNote, Loading, PageHeader } from '../components/common'
import { Icon } from '../components/Icon'
import { TrendFlag } from '../components/TrendFlag'
import { attentionItems } from '../lib/attention'
import { formatDate, formatMonth } from '../lib/format'

export function HomePage() {
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const timeline = useApi(() => api.getTimeline(DEMO_PATIENT_ID), 'timeline')
  const journeys = useApi(() => api.getJourneys(DEMO_PATIENT_ID), 'journeys')

  if (!record.data || !timeline.data || !journeys.data) return <Loading label="Loading your care overview…" />

  const r = record.data
  const attention = attentionItems(journeys.data)
  const firstName = r.patient.display_name.split(' ')[0]
  const activeJourneys = journeys.data.filter((j) => j.steps.some((s) => s.status !== 'complete'))
  const upcoming = journeys.data.filter((j) => j.appointment_date).sort((a, b) => a.appointment_date!.localeCompare(b.appointment_date!))
  const openReferrals = r.referrals.filter((x) => x.status !== 'completed')
  const recentEvents = [...timeline.data.events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const topFlag = timeline.data.flags[0]
  const firstEncounter = [...r.encounters].sort((a, b) => a.date.localeCompare(b.date))[0]
  const clinicians = new Set(r.encounters.map((e) => e.provider_name)).size

  return (
    <>
      <PageHeader
        eyebrow="HERA overview"
        title={`Welcome back, ${firstName}`}
        lede={
          <>
            Your care is connected across <strong>{r.patient.record_sources.length} health systems</strong>,{' '}
            <strong>{clinicians} clinicians</strong> and <strong>{r.encounters.length} visits</strong> since{' '}
            {formatDate(firstEncounter.date, { year: true })}. HERA keeps the whole story together so nothing gets lost between appointments.
          </>
        }
        actions={<DataSourceNote source={record.source} />}
      />

      {attention.length > 0 && (
        <section aria-labelledby="attention-h" className="stack-sm" style={{ marginBottom: 24 }}>
          <h2 id="attention-h" className="section-label">Needs attention</h2>
          {attention.map((a) => (
            <Alert
              key={a.id}
              tone={a.tone}
              title={a.title}
              action={
                <Link className="btn btn-secondary btn-sm" to={a.tone === 'review' ? '/access#travel' : '/journey'}>
                  {a.tone === 'review' ? 'Compare routes' : 'View journey'}
                </Link>
              }
            >
              {a.detail}
            </Alert>
          ))}
        </section>
      )}

      <div className="grid grid-main">
        <div className="stack">
          <Card icon="journey" title="Active care" sub={`${activeJourneys.length} care needs in progress`} action={<CardLink to="/journey">Care journey</CardLink>}>
            <ul className="list">
              {activeJourneys.map((j) => {
                const done = j.steps.filter((s) => s.status === 'complete').length
                const stalled = j.steps.some((s) => s.status === 'stalled')
                return (
                  <li key={j.journey_id}>
                    <div className="list-main">
                      <div className="list-title">{j.care_need}</div>
                      <div className="list-meta">
                        {j.provider_name ? `${j.provider_name} · ` : ''}started {formatDate(j.started_date)}
                      </div>
                      <div className="progress" aria-label={`${done} of ${j.steps.length} steps complete`}>
                        {j.steps.map((s) => <span key={s.step_id} className={`progress-seg is-${s.status}`} />)}
                      </div>
                    </div>
                    <div className="list-aside">
                      {stalled ? (
                        <span className="badge badge-stalled"><Icon name="pause" size={12} /> Stalled</span>
                      ) : (
                        <span className="badge badge-accent num">{done}/{j.steps.length} steps</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card icon="clock" title="Recent health changes" sub="From all connected records" action={<CardLink to="/timeline">Full timeline</CardLink>}>
            <ul className="list">
              {recentEvents.map((e) => {
                const m = formatMonth(e.date)
                return (
                  <li key={e.event_id}>
                    <span className="date-chip num"><span>{m.month}</span>{e.date.slice(8, 10)}</span>
                    <div className="list-main">
                      <div className="list-title">{e.title}</div>
                      <div className="list-meta">{e.setting}</div>
                    </div>
                    {e.flag_ids.length > 0 && <Icon name="flag" size={14} className="flag-dot" />}
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>

        <div className="stack">
          <Card icon="calendar" title="Upcoming" action={<CardLink to="/journey">All</CardLink>}>
            {upcoming.length === 0 ? (
              <div className="empty">No upcoming appointments</div>
            ) : (
              <ul className="list">
                {upcoming.map((j) => {
                  const m = formatMonth(j.appointment_date!)
                  return (
                    <li key={j.journey_id}>
                      <span className="date-chip date-chip-accent num"><span>{m.month}</span>{j.appointment_date!.slice(8, 10)}</span>
                      <div className="list-main">
                        <div className="list-title">{j.care_need.split(' — ')[0]}</div>
                        <div className="list-meta">{j.provider_name}</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {topFlag && (
            <Card icon="flag" title="Health trend" sub="Longitudinal pattern across your records" action={<CardLink to="/timeline">Details</CardLink>}>
              <div className="card-body">
                <TrendFlag flag={topFlag} compact />
              </div>
            </Card>
          )}

          <Card icon="arrow" title="Active referrals">
            <ul className="list">
              {openReferrals.map((x) => (
                <li key={x.referral_id}>
                  <div className="list-main">
                    <div className="list-title">{x.specialty}</div>
                    <div className="list-meta">Placed {formatDate(x.placed_date)} by {x.referred_by}</div>
                  </div>
                  <span className={`badge ${x.status === 'stalled' ? 'badge-stalled' : x.status === 'scheduled' ? 'badge-good' : ''}`}>
                    {x.status === 'stalled' ? `Stalled · ${x.days_open}d` : x.status === 'scheduled' ? 'Scheduled' : 'Open'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
