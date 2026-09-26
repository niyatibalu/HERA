import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { ConnectedRecordCard, ConnectedSources } from '../components/ConnectedRecordCard'
import { Alert, DataSourceNote, Loading, PageHeader } from '../components/common'
import type { RecordSource } from '../types'
import { formatDate } from '../lib/format'

const SETTING_LABEL = {
  primary_care: 'Primary care',
  specialist: 'Specialist',
  urgent_care: 'Urgent care',
  emergency: 'Emergency',
  telehealth: 'Telehealth',
} as const

export function RecordPage() {
  const { data: r, source } = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  if (!r) return <Loading label="Loading connected records…" />

  const sourcesFor = (ids: string[]): RecordSource[] => r.patient.record_sources.filter((s) => ids.includes(s.source_id))
  const encounters = [...r.encounters].sort((a, b) => b.date.localeCompare(a.date))
  const specialists = [...new Map(r.encounters.map((e) => [e.provider_name, e])).values()]

  return (
    <>
      <PageHeader
        eyebrow="Unified health record"
        title="Connected health records"
        lede="One view of diagnoses, medications, labs, imaging and visits gathered from every system this patient has authorized. Each item keeps a link to where it came from."
        actions={<DataSourceNote source={source} />}
      />

      <Alert tone="info" title="Simulated record connection">
        For this demo, HERA uses a fictional patient and simulated EHR / patient-portal connections. No real MyChart or hospital data is accessed.
      </Alert>

      <div className="grid grid-4 section-gap">
        <Stat label="Connected sources" value={r.patient.record_sources.length} note="EHR, portal, labs" />
        <Stat label="Visits" value={r.encounters.length} note={`${specialists.length} clinicians`} />
        <Stat label="Active diagnoses" value={r.diagnoses.filter((d) => d.status !== 'resolved').length} note={`${r.diagnoses.filter((d) => d.status === 'under_evaluation').length} under evaluation`} />
        <Stat label="Open referrals" value={r.referrals.filter((x) => x.status !== 'completed').length} note={`${r.referrals.filter((x) => x.status === 'stalled').length} stalled`} />
      </div>

      <div className="grid grid-main section-gap">
        <div className="stack">
          <ConnectedRecordCard title="Diagnoses" icon="stethoscope" count={r.diagnoses.length} sources={sourcesFor(r.diagnoses.map((d) => d.source_id))}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Condition</th><th>Status</th><th>First recorded</th><th>By</th></tr></thead>
                <tbody>
                  {r.diagnoses.map((d) => (
                    <tr key={d.diagnosis_id}>
                      <td><strong>{d.name}</strong> <span className="muted num">{d.icd10_code}</span></td>
                      <td><StatusPill status={d.status} /></td>
                      <td className="num nowrap">{formatDate(d.first_recorded_date, { year: true })}</td>
                      <td>{d.recorded_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ConnectedRecordCard>

          <ConnectedRecordCard title="Recent labs" icon="lab" count={r.labs.length} sources={sourcesFor(r.labs.map((l) => l.source_id))}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Test</th><th>Result</th><th>Reference</th><th>Collected</th><th>Previous</th></tr></thead>
                <tbody>
                  {r.labs.map((l) => (
                    <tr key={l.lab_id}>
                      <td><strong>{l.test_name}</strong></td>
                      <td className="num">
                        {l.test_name.startsWith('hCG') ? 'Negative' : `${l.value} ${l.unit}`}{' '}
                        {l.flag !== 'normal' && <span className="badge badge-review">{l.flag === 'low' ? 'Low' : 'High'}</span>}
                      </td>
                      <td className="num muted">{l.reference_range}</td>
                      <td className="num nowrap">{formatDate(l.collected_date, { year: true })}</td>
                      <td className="num muted">{l.history.length > 1 ? l.history.slice(0, -1).map((h) => h.value).join(' → ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ConnectedRecordCard>

          <ConnectedRecordCard title="Visits" icon="calendar" count={encounters.length} sources={sourcesFor(encounters.map((e) => e.source_id))}>
            <ul className="list">
              {encounters.map((e) => (
                <li key={e.encounter_id}>
                  <div className="list-main">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="list-title">{e.reason}</span>
                      <span className="badge">{SETTING_LABEL[e.setting]}</span>
                    </div>
                    <div className="list-meta">{e.provider_name} · {e.specialty} · {e.facility}</div>
                    <p className="note">{e.notes_summary}</p>
                  </div>
                  <div className="list-aside num">{formatDate(e.date, { year: true })}</div>
                </li>
              ))}
            </ul>
          </ConnectedRecordCard>
        </div>

        <div className="stack">
          <ConnectedSources sources={r.patient.record_sources} />

          <ConnectedRecordCard title="Medications" icon="pill" count={r.medications.length} sources={[]}>
            <ul className="list">
              {r.medications.map((m) => (
                <li key={m.medication_id}>
                  <div className="list-main">
                    <div className="list-title">{m.name}</div>
                    <div className="list-meta">{m.dose} · {m.frequency} · for {m.reason.toLowerCase()}</div>
                    <div className="list-meta">
                      {m.prescriber} · {m.end_date ? 'from' : 'since'} {formatDate(m.start_date, { year: true })}
                      {m.end_date && ` – ${formatDate(m.end_date, { year: true })}`}
                    </div>
                  </div>
                  <span className={`badge ${m.status === 'active' ? 'badge-good' : ''}`}>{m.status === 'active' ? 'Active' : 'Stopped'}</span>
                </li>
              ))}
            </ul>
          </ConnectedRecordCard>

          <ConnectedRecordCard title="Imaging" icon="scan" count={r.imaging.length} sources={sourcesFor(r.imaging.map((i) => i.source_id))}>
            <ul className="list">
              {r.imaging.map((i) => (
                <li key={i.imaging_id}>
                  <div className="list-main">
                    <div className="list-title">{i.modality}</div>
                    <div className="list-meta">
                      {i.body_region} · ordered {formatDate(i.ordered_date)}
                      {i.summary && ` · ${i.summary}`}
                    </div>
                  </div>
                  <span className={`badge ${i.status === 'recommended' ? 'badge-stalled' : i.status === 'completed' ? 'badge-good' : 'badge-info'}`}>
                    {i.status === 'recommended' ? 'Not yet scheduled' : i.status === 'completed' ? 'Completed' : 'Scheduled'}
                  </span>
                </li>
              ))}
            </ul>
          </ConnectedRecordCard>

          <ConnectedRecordCard title="Referrals" icon="arrow" count={r.referrals.length} sources={[]}>
            <ul className="list">
              {r.referrals.map((x) => (
                <li key={x.referral_id}>
                  <div className="list-main">
                    <div className="list-title">{x.specialty}</div>
                    <div className="list-meta">{x.reason} · {x.referred_by} · {formatDate(x.placed_date, { year: true })}</div>
                  </div>
                  <span className={`badge ${x.status === 'stalled' ? 'badge-stalled' : x.status === 'completed' ? 'badge-good' : 'badge-info'}`}>
                    {x.status[0].toUpperCase() + x.status.slice(1)}
                  </span>
                </li>
              ))}
            </ul>
          </ConnectedRecordCard>

          <ConnectedRecordCard title="Specialists & procedures" icon="user" sources={sourcesFor(r.procedures.map((p) => p.source_id))}>
            <ul className="list">
              {specialists.map((e) => (
                <li key={e.provider_name}>
                  <div className="list-main">
                    <div className="list-title">{e.provider_name}</div>
                    <div className="list-meta">{e.specialty} · {e.facility}</div>
                  </div>
                </li>
              ))}
              {r.procedures.map((p) => (
                <li key={p.procedure_id}>
                  <div className="list-main">
                    <div className="list-title">{p.name}</div>
                    <div className="list-meta">{p.provider_name} · {formatDate(p.date, { year: true })}</div>
                  </div>
                  <span className="badge">Procedure</span>
                </li>
              ))}
            </ul>
          </ConnectedRecordCard>
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  )
}

function StatusPill({ status }: { status: 'active' | 'resolved' | 'under_evaluation' }) {
  if (status === 'under_evaluation') return <span className="badge badge-review">Under evaluation</span>
  if (status === 'resolved') return <span className="badge">Resolved</span>
  return <span className="badge badge-info">Active</span>
}
