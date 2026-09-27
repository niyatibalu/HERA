import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { ConnectedRecordCard, ConnectedSources } from '../components/ConnectedRecordCard'
import { Loading, PageHeader } from '../components/common'
import { MyChartCard } from '../components/MyChartCard'
import { careTeam, conditions, groupEvents, providerLookup } from '../lib/record'
import { formatDate, humanize, specialtyLabel } from '../lib/format'
import type { HealthEvent } from '../types'

export function RecordPage() {
  const { data: r } = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const mychart = useApi(() => api.getMyChart(DEMO_PATIENT_ID), 'mychart')
  if (!r || !mychart.data) return <Loading label="Loading connected records…" />

  if (mychart.data.status !== 'connected') {
    return (
      <>
        <PageHeader
          eyebrow="Unified health record"
          title="Connected health records"
          lede="Connect MyChart once to bring every health system into one record."
        />
        <MyChartCard connection={mychart.data} />
      </>
    )
  }

  const provider = providerLookup(r.providers)
  const g = groupEvents(r.events)
  const conds = conditions(r.events)
  const team = careTeam(r)
  const by = (evs: HealthEvent[]) => evs.map((e) => provider(e.provider_id)?.name).filter((n): n is string => !!n)
  const openReferrals = g.referral.filter((x) => x.status !== 'completed')

  return (
    <>
      <PageHeader
        eyebrow="Unified health record"
        title="Connected health records"
        lede="Everything from your connected health systems, in one place."
      />

      <div className="stack">
        <MyChartCard connection={mychart.data} />
      </div>

      <div className="grid grid-4 section-gap">
        <Stat label="Visits" value={g.encounter.length} note={`${team.length} clinicians · ${new Set(g.encounter.map((e) => e.specialty)).size} specialties`} />
        <Stat label="Conditions tracked" value={conds.length} note={`${conds.filter((c) => c.status === 'ongoing').length} under evaluation`} />
        <Stat label="Medications" value={g.medication.length} note={`${g.medication.filter((m) => m.raw?.treatment_category === 'hormonal_therapy').length} hormonal therapy trials`} />
        <Stat label="Open referrals" value={openReferrals.length} note={openReferrals[0] ? specialtyLabel(openReferrals[0].specialty) : 'None'} />
      </div>

      <div className="grid grid-main section-gap">
        <div className="stack">
          <ConnectedRecordCard title="Conditions" icon="stethoscope" count={conds.length} from={by([...g.diagnosis, ...g.symptom])}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Condition</th><th>Status</th><th>First documented</th><th>Records</th></tr></thead>
                <tbody>
                  {conds.map((c) => (
                    <tr key={c.topic}>
                      <td><strong>{c.label}</strong> {c.icd10 && <span className="muted num">{c.icd10}</span>}</td>
                      <td>{c.status === 'ongoing' ? <span className="badge badge-review">Under evaluation</span> : c.status === 'resolved' ? <span className="badge">Resolved</span> : <span className="badge badge-info">Active</span>}</td>
                      <td className="num nowrap">{formatDate(c.first_seen, { year: true })}</td>
                      <td className="num">{c.event_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ConnectedRecordCard>

          <ConnectedRecordCard title="Labs" icon="lab" count={g.lab.length} from={by(g.lab)}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Result</th><th>Value</th><th>Collected</th><th>Ordered by</th></tr></thead>
                <tbody>
                  {g.lab.map((l) => (
                    <tr key={l.event_id}>
                      <td>{l.description}</td>
                      <td className="num nowrap"><strong>{l.value} {l.unit}</strong></td>
                      <td className="num nowrap">{formatDate(l.event_date, { year: true })}</td>
                      <td>{provider(l.provider_id)?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ConnectedRecordCard>

          <ConnectedRecordCard title="Visits" icon="calendar" count={g.encounter.length} from={by(g.encounter)}>
            <ul className="list">
              {g.encounter.map((e) => {
                const notes = r.events.filter((x) => x.event_date === e.event_date && x.event_type === 'symptom')
                return (
                  <li key={e.event_id}>
                    <div className="list-main">
                      <div className="row" style={{ gap: 8 }}>
                        <span className="list-title">{humanize(e.topic)}</span>
                        <span className="badge">{specialtyLabel(e.specialty)}</span>
                      </div>
                      <div className="list-meta">{provider(e.provider_id)?.name}</div>
                      <p className="note">{e.description}</p>
                      {notes.map((n) => (
                        <p key={n.event_id} className="note muted">
                          Patient-reported: {n.description}{n.severity != null && <> (severity <span className="num">{n.severity}/5</span>)</>}
                        </p>
                      ))}
                    </div>
                    <div className="list-aside num nowrap">{formatDate(e.event_date, { year: true })}</div>
                  </li>
                )
              })}
            </ul>
          </ConnectedRecordCard>
        </div>

        <div className="stack">
          {r.record_sources && <ConnectedSources sources={r.record_sources} />}

          <ConnectedRecordCard title="Medications" icon="pill" count={g.medication.length} from={by(g.medication)}>
            <ul className="list">
              {g.medication.map((m) => (
                <li key={m.event_id}>
                  <div className="list-main">
                    <div className="list-title">{m.description}</div>
                    <div className="list-meta">
                      For {humanize(m.topic).toLowerCase()} · {provider(m.provider_id)?.name} · {formatDate(m.event_date, { year: true })}
                    </div>
                  </div>
                  <span className={`badge ${m.status === 'active' ? 'badge-good' : ''}`}>{humanize(m.status ?? 'active')}</span>
                </li>
              ))}
            </ul>
          </ConnectedRecordCard>

          <ConnectedRecordCard title="Imaging & procedures" icon="scan" count={g.imaging.length + g.procedure.length} from={by([...g.imaging, ...g.procedure])}>
            <ul className="list">
              {[...g.imaging, ...g.procedure].map((i) => (
                <li key={i.event_id}>
                  <div className="list-main">
                    <div className="list-title">{i.description}</div>
                    <div className="list-meta">{provider(i.provider_id)?.name} · {formatDate(i.event_date, { year: true })}</div>
                  </div>
                  <span className="badge badge-good">{humanize(i.status ?? 'completed')}</span>
                </li>
              ))}
            </ul>
          </ConnectedRecordCard>

          <ConnectedRecordCard title="Referrals" icon="arrow" count={g.referral.length} from={by(g.referral)}>
            <ul className="list">
              {g.referral.map((x) => (
                <li key={x.event_id}>
                  <div className="list-main">
                    <div className="list-title">{specialtyLabel(x.specialty)}</div>
                    <div className="list-meta">{x.description}</div>
                    <div className="list-meta">{provider(x.provider_id)?.name} · {formatDate(x.event_date, { year: true })}</div>
                  </div>
                  <span className={`badge ${x.status === 'completed' ? 'badge-good' : 'badge-review'}`}>{humanize(x.status ?? 'pending')}</span>
                </li>
              ))}
            </ul>
          </ConnectedRecordCard>

          <ConnectedRecordCard title="Care team" icon="user" count={team.length} from={[]}>
            <ul className="list">
              {team.map(({ provider: p, visits }) => (
                <li key={p!.provider_id}>
                  <div className="list-main">
                    <div className="list-title">{p!.name}</div>
                    <div className="list-meta">{specialtyLabel(p!.specialty)} · {p!.location.address}</div>
                  </div>
                  <span className="badge num">{visits} visits</span>
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
