import { useState } from 'react'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { Card, DataSourceNote, Loading, PageHeader } from '../components/common'
import { Icon } from '../components/Icon'
import { ResearchConsentCard, type ConsentView } from '../components/ResearchConsentCard'
import { StudyMatchCard } from '../components/StudyMatchCard'
import type { ResearchConsent } from '../types'

function consentView(c: ResearchConsent): ConsentView {
  if (c.consent && !c.revoked) return 'granted'
  if (c.revoked || c.consent_timestamp) return 'declined'
  return 'not_asked'
}

export function ResearchPage() {
  const consent = useApi(() => api.getConsent(DEMO_PATIENT_ID), 'consent')
  const status = consent.data ? consentView(consent.data) : undefined
  const matches = useApi(() => api.getStudyMatches(DEMO_PATIENT_ID), `matches:${status}`)
  const [busy, setBusy] = useState(false)

  if (!consent.data) return <Loading label="Loading research preferences…" />

  const choose = async (value: boolean) => {
    setBusy(true)
    await api.setConsent(DEMO_PATIENT_ID, value)
    setBusy(false)
  }

  return (
    <>
      <PageHeader
        eyebrow="Research"
        title="Women’s health research, on your terms"
        lede="Researchers often can’t find the right participants, and eligible women rarely hear about relevant studies. HERA can connect the two without ever exposing who you are."
        actions={<DataSourceNote source={consent.source} />}
      />

      <div className="grid grid-main">
        <ResearchConsentCard status={status!} busy={busy} onChoose={choose} />

        <aside className="stack">
          <Card icon="shield" title="How matching works">
            <ol className="how">
              <li>HERA builds a de-identified research profile under a random code, not your name.</li>
              <li>Researchers publish criteria, such as “ages 18–35 with pelvic pain for more than 6 months”.</li>
              <li>HERA checks the criteria against de-identified profiles. Researchers only see how many people might match.</li>
              <li>If you might be eligible, HERA tells you. You decide what happens next.</li>
            </ol>
          </Card>
        </aside>
      </div>

      {status === 'granted' && (
        <section className="section-gap" aria-labelledby="studies-h">
          <h2 id="studies-h" className="section-label">Studies you may be eligible for</h2>
          {!matches.data ? (
            <Loading label="Checking studies…" />
          ) : matches.data.length === 0 ? (
            <div className="card empty">No matching studies right now. HERA will let you know if one opens.</div>
          ) : (
            <div className="grid grid-2" style={{ marginTop: 8 }}>
              {matches.data.map((m) => <StudyMatchCard key={m.study_id} match={m} />)}
            </div>
          )}
          <p className="demo-note" style={{ marginTop: 12 }}>
            <Icon name="info" size={13} /> You have not been enrolled in any study.
          </p>
        </section>
      )}
    </>
  )
}
