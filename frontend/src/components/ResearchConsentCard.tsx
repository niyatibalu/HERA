import { Icon } from './Icon'

export type ConsentView = 'not_asked' | 'granted' | 'declined'

const SHARED = ['Age range (e.g. 25–34)', 'Conditions and how long symptoms have lasted', 'Treatment history (e.g. hormonal therapy)', 'Lab trends, without dates or clinic names', 'General region (e.g. Southern Wisconsin)']
const NEVER = ['Your name, date of birth or address', 'Contact details', 'Insurance or record numbers', 'Clinician notes', 'Which clinics you visited']

/** Explicit, optional consent for de-identified research matching. Study participation is a separate decision. */
export function ResearchConsentCard({ status, busy, onChoose }: {
  status: ConsentView
  busy?: boolean
  onChoose: (consent: boolean) => void
}) {
  return (
    <section className="card consent" aria-labelledby="consent-h">
      <div className="card-body stack">
        <div className="consent-head">
          <span className="consent-icon" aria-hidden="true"><Icon name="research" size={22} /></span>
          <div>
            <div className="row" style={{ gap: 8 }}>
              <h2 id="consent-h" className="consent-title">Help improve women’s health research</h2>
              <span className="badge">Optional</span>
            </div>
            <p className="consent-q">
              Would you like to allow <strong>de-identified</strong> information from your HERA health profile to be used to find research studies you may be eligible for?
            </p>
          </div>
        </div>

        <ul className="consent-points">
          <li><Icon name="check" size={15} /> <span><strong>Completely optional.</strong> Your care in HERA is the same whether you say yes or no.</span></li>
          <li><Icon name="shield" size={15} /> <span><strong>Researchers never see who you are.</strong> They only see anonymous counts of people who may match a study.</span></li>
          <li><Icon name="user" size={15} /> <span><strong>Joining a study is a separate decision.</strong> If a study looks like a fit, HERA will tell you. You decide whether to learn more or take part.</span></li>
          <li><Icon name="x" size={15} /> <span><strong>You can turn this off at any time.</strong> Matching stops right away.</span></li>
        </ul>

        <div className="grid grid-2 consent-lists">
          <div>
            <div className="why-h">Used for matching (de-identified)</div>
            <ul>{SHARED.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
          <div>
            <div className="why-h">Never shared with researchers</div>
            <ul className="never">{NEVER.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        </div>

        {status === 'granted' ? (
          <div className="consent-status is-on" role="status">
            <Icon name="check" size={16} />
            <span><strong>Research matching is on.</strong> Only de-identified information is used.</span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onChoose(false)}>Turn off research matching</button>
          </div>
        ) : (
          <>
            {status === 'declined' && (
              <div className="consent-status" role="status">
                <Icon name="info" size={16} />
                <span>Research matching is off. Nothing from your record is used for research. You can change your mind at any time.</span>
              </div>
            )}
            <div className="row consent-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onChoose(true)}>Yes, I’m interested</button>
              {status === 'not_asked' && (
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onChoose(false)}>Not now</button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
