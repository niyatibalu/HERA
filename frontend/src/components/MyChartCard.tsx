import { useState } from 'react'
import { api, DEMO_PATIENT_ID } from '../api/client'
import type { MyChartConnection } from '../types'
import { Icon } from './Icon'
import { formatDate, humanize } from '../lib/format'

const SCOPE_LABEL: Record<string, string> = {
  visits: 'Visits and visit summaries',
  conditions: 'Conditions and problem list',
  medications: 'Medications',
  labs: 'Lab results',
  imaging: 'Imaging reports',
  referrals: 'Referrals',
  clinical_notes: 'Clinician notes',
}
const IMPORT_LABEL: Record<string, string> = { encounter: 'visits', symptom: 'documented symptoms', lab: 'lab results', medication: 'medications', referral: 'referrals', diagnosis: 'conditions', imaging: 'imaging', procedure: 'procedures' }

/**
 * Patient-authorized MyChart link. Simulated for the hackathon: the "sign in" step never contacts
 * a real MyChart/Epic system, and the imported record is synthetic.
 */
export function MyChartCard({ connection, compact = false }: { connection: MyChartConnection; compact?: boolean }) {
  const [step, setStep] = useState<'idle' | 'consent' | 'connecting'>('idle')
  const [error, setError] = useState<string | null>(null)

  const connect = async () => {
    setStep('connecting')
    setError(null)
    try {
      // A short pause so the demo reads like a real authorization round trip.
      await new Promise((r) => setTimeout(r, 900))
      await api.connectMyChart(DEMO_PATIENT_ID)
      setStep('idle')
    } catch {
      setError('Could not connect. Please try again.')
      setStep('consent')
    }
  }

  if (connection.status === 'connected') {
    const total = Object.values(connection.imported).reduce((a, b) => a + (b ?? 0), 0)
    return (
      <section className="card mychart is-connected" aria-labelledby="mychart-h">
        <header className="card-header">
          <div>
            <h2 className="card-title" id="mychart-h"><span className="mychart-mark" aria-hidden="true">M</span> MyChart connected</h2>
            <div className="card-sub">
              Read-only · synced {connection.last_synced_at ? formatDate(connection.last_synced_at, { year: true }) : 'today'}
              {connection.simulated && ' · simulated connection'}
            </div>
          </div>
          <span className="badge badge-good"><Icon name="check" size={12} /> {total} records imported</span>
        </header>
        {!compact && (
          <div className="card-body stack-sm">
            <div className="row">
              {Object.entries(connection.imported).map(([k, n]) => (
                <span key={k} className="badge num">{n} {IMPORT_LABEL[k] ?? humanize(k)}</span>
              ))}
            </div>
            <div className="list-meta">From {connection.organizations.map((o) => o.name).join(', ')}</div>
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => api.disconnectMyChart(DEMO_PATIENT_ID)}>
                Disconnect MyChart
              </button>
            </div>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="card mychart" aria-labelledby="mychart-h">
      <header className="card-header">
        <div>
          <h2 className="card-title" id="mychart-h"><span className="mychart-mark" aria-hidden="true">M</span> Connect your MyChart</h2>
          <div className="card-sub">Bring your records from every health system into one place · simulated connection</div>
        </div>
      </header>
      <div className="card-body stack-sm">
        {step === 'idle' && (
          <>
            <p className="muted">
              HERA reads your visits, conditions, medications, labs and referrals from MyChart so every new clinician sees the whole story. Read-only, and you can disconnect at any time.
            </p>
            <div>
              <button type="button" className="btn btn-primary" onClick={() => setStep('consent')}>
                <Icon name="link" size={16} /> Connect MyChart
              </button>
            </div>
          </>
        )}
        {step === 'consent' && (
          <>
            <div className="section-label">HERA is asking to read</div>
            <ul className="scope-list">
              {Object.entries(SCOPE_LABEL).map(([k, label]) => (
                <li key={k}><Icon name="check" size={14} /> {label}</li>
              ))}
            </ul>
            <p className="list-meta">
              HERA can't change anything in MyChart. In this demo no real account is used: signing in is simulated and the records are synthetic.
            </p>
            {error && <p className="error-text">{error}</p>}
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={connect}>Allow and connect</button>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('idle')}>Cancel</button>
            </div>
          </>
        )}
        {step === 'connecting' && (
          <p className="row" role="status"><span className="spinner" aria-hidden="true" /> Signing in to MyChart and importing records…</p>
        )}
      </div>
    </section>
  )
}
