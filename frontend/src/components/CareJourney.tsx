import type { ReactNode } from 'react'
import type { CareJourney as CareJourneyData, CareState, Provider } from '../types'
import { Icon, type IconName } from './Icon'
import { daysInState, isComplete, journeySteps, type StepStatus } from '../lib/journey'
import { formatDate, humanize } from '../lib/format'
import { journeyAppointmentDate } from '../lib/providers'
import { formatTime } from '../lib/scheduling'

const prettyNote = (note: string) => note.replace(/\d{4}-\d{2}-\d{2}/g, (d) => formatDate(d, { year: true }))

const STATUS_ICON: Record<StepStatus, IconName | null> = { complete: 'check', in_progress: 'clock', stalled: 'pause', pending: null }
const STALL_PHRASE: Partial<Record<CareState, string>> = {
  provider_matched: 'Provider matching has stalled.',
  records_ready: 'Record sharing has stalled.',
  appointment_scheduled: 'Scheduling has stalled.',
  travel_planned: 'Travel planning has stalled.',
  appointment_completed: 'The appointment has not been completed.',
  followup_completed: 'Follow-up has stalled.',
}
const STATUS_TEXT: Record<StepStatus, string> = { complete: 'Complete', in_progress: 'In progress', stalled: 'Stalled', pending: 'Not started' }

/** A care need tracked from identification to follow-up, so a referral can't quietly stall. */
export function CareJourney({ journey, provider, today, stalledAction, children }: {
  journey: CareJourneyData
  provider?: Provider
  today: string
  stalledAction?: ReactNode
  children?: ReactNode
}) {
  const steps = journeySteps(journey)
  const done = isComplete(journey)
  const stalled = steps.find((s) => s.status === 'stalled')
  const appointment = journeyAppointmentDate(journey)

  return (
    <section className={`card journey ${stalled ? 'is-stalled' : ''}`} aria-label={`Care journey: ${humanize(journey.need)}`}>
      <header className="card-header">
        <div>
          <h2 className="card-title">{humanize(journey.need)}</h2>
          <div className="card-sub">
            {provider ? `${provider.name} · ` : ''}
            {appointment ? `Appointment ${formatDate(appointment, { year: true })}${journey.appointment_time ? ` at ${formatTime(journey.appointment_time)}` : ''}${journey.appointment_modality === 'telehealth' ? ' · video visit' : ''}` : 'No appointment yet'}
          </div>
        </div>
        {done ? (
          <span className="badge badge-good"><Icon name="check" size={12} /> Pathway complete</span>
        ) : stalled ? (
          <span className="badge badge-stalled"><Icon name="pause" size={12} /> Stalled {daysInState(journey, today)} days</span>
        ) : (
          <span className="badge badge-accent">In progress</span>
        )}
      </header>

      <ol className="stepper">
        {steps.map((s, i) => (
          <li key={s.state} className={`step is-${s.status}`} aria-current={s.status === 'in_progress' || s.status === 'stalled' ? 'step' : undefined}>
            <span className="step-node" aria-hidden="true">
              {STATUS_ICON[s.status] ? <Icon name={STATUS_ICON[s.status]!} size={13} /> : <span className="num">{i + 1}</span>}
            </span>
            <div className="step-text">
              <div className="step-label">{s.label}</div>
              <div className="step-meta">
                <span className="visually-hidden">{STATUS_TEXT[s.status]}. </span>
                {s.date ? formatDate(s.date) : s.status === 'stalled' ? `${daysInState(journey, today)} days` : s.status === 'in_progress' ? 'Up next' : ''}
              </div>
              {s.note && s.status !== 'pending' && <div className="step-note">{prettyNote(s.note)}</div>}
            </div>
          </li>
        ))}
      </ol>

      {stalled && (
        <div className="journey-stall">
          <Icon name="alert" size={16} />
          <div>
            <strong>{STALL_PHRASE[stalled.state] ?? `${stalled.label} has stalled.`}</strong> {journey.stalled_reason}
          </div>
          {stalledAction}
        </div>
      )}
      {!stalled && journey.stall_warning && (
        <div className="journey-stall is-warning">
          <Icon name="clock" size={16} />
          <div><strong>At risk of stalling.</strong> {journey.stall_warning}</div>
          {stalledAction}
        </div>
      )}
      {children}
    </section>
  )
}
