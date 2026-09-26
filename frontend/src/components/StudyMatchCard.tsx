import { useId, useState } from 'react'
import type { StudyMatch } from '../types'
import { Icon } from './Icon'

/** A study the patient may be eligible for. Showing it never enrolls her or shares her identity. */
export function StudyMatchCard({ match }: { match: StudyMatch }) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  return (
    <article className="card study" aria-label={`Study: ${match.title ?? match.study_id}`}>
      <div className="card-body stack-sm">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="badge badge-accent">Potential match</span>
          <span className="muted" style={{ fontSize: 12 }}>Not a guarantee of eligibility</span>
        </div>
        <h3 className="study-title">{match.title ?? 'Women’s health research study'}</h3>
        {match.description && <p className="note" style={{ marginTop: 0 }}>{match.description}</p>}

        <div className="why-h" style={{ marginTop: 6 }}>Potential match based on</div>
        <ul className="criteria">
          {match.criteria_satisfied.map((c) => (
            <li key={c}><Icon name="check" size={14} /> {c}</li>
          ))}
          {match.criteria_unknown.map((c) => (
            <li key={c} className="is-unknown"><Icon name="info" size={14} /> {c} <span className="muted">(not in your record)</span></li>
          ))}
        </ul>

        {open && (
          <div id={detailsId} className="study-details">
            <p>{match.reason}</p>
            <p>
              <strong>Nothing happens automatically.</strong> HERA has not shared your name or contact details with this study. To take part, you would talk with the research team and review and sign the study’s own consent form.
            </p>
          </div>
        )}
        <div className="row" style={{ marginTop: 6 }}>
          <button type="button" className="btn btn-secondary btn-sm" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((o) => !o)}>
            {open ? 'Show less' : 'Learn more'}
          </button>
        </div>
      </div>
    </article>
  )
}
