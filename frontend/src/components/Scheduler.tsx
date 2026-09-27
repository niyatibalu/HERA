import { useState } from 'react'
import type { ProviderMatch } from '../types'
import { availableDays, formatDay, formatTime, type Booking, type Modality } from '../lib/scheduling'
import { DEMO_TODAY } from '../mocks/record'

/** Pick a visit type, day and time with a chosen provider, then confirm the booking. */
export function Scheduler({ match, busy, onConfirm, onCancel }: {
  match: ProviderMatch
  busy: boolean
  onConfirm: (b: Booking) => void
  onCancel: () => void
}) {
  const p = match.provider
  const days = availableDays(p, DEMO_TODAY)
  const [modality, setModality] = useState<Modality>('in_person')
  const [pick, setPick] = useState<{ date: string; time: string } | null>(null)

  return (
    <section className="card scheduler" aria-labelledby="schedule-h">
      <div className="card-body stack">
        <div className="panel-row">
          <div>
            <h2 id="schedule-h" className="section-title">Book with {p.name}</h2>
            <p className="card-sub">Pick a time that works for you</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>

        {p.telehealth_available && (
          <div className="segmented" role="radiogroup" aria-label="Visit type">
            {(['in_person', 'telehealth'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={modality === m} className={`segment ${modality === m ? 'is-on' : ''}`} onClick={() => setModality(m)}>
                {m === 'in_person' ? 'In person' : 'Video visit'}
              </button>
            ))}
          </div>
        )}

        <div className="slot-days" role="radiogroup" aria-label="Appointment time">
          {days.map((d) => (
            <div key={d.date} className="slot-day">
              <div className="slot-day-label">
                {formatDay(d.date)}
                <span className="slot-day-open">{d.slots.filter((x) => !x.booked).length} open</span>
              </div>
              {d.slots.map(({ time: t, booked }) => {
                const on = pick?.date === d.date && pick.time === t
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={booked}
                    aria-label={`${formatDay(d.date)} at ${formatTime(t)}${booked ? ', booked' : ''}`}
                    className={`slot ${on ? 'is-on' : ''} ${booked ? 'is-booked' : ''}`}
                    onClick={() => setPick({ date: d.date, time: t })}
                  >
                    {formatTime(t)}
                    {booked && <span className="slot-note">Booked</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="row">
          <button type="button" className="btn btn-primary btn-lg" disabled={!pick || busy} onClick={() => pick && onConfirm({ ...pick, modality })}>
            {busy ? 'Booking…' : pick ? `Book ${formatDay(pick.date)} at ${formatTime(pick.time)}` : 'Choose a time'}
          </button>
        </div>
      </div>
    </section>
  )
}
