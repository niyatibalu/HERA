import type { ReactNode } from 'react'
import type { RecordSource } from '../types'
import { Card } from './common'
import type { IconName } from './Icon'
import { Icon } from './Icon'
import { formatSyncTime } from '../lib/format'

/** A section of the unified record, attributed to the clinicians/systems it came from. */
export function ConnectedRecordCard({ title, icon, count, from, children, action }: {
  title: string
  icon: IconName
  count?: number
  /** Names of the clinicians or systems that documented this section. */
  from: string[]
  children: ReactNode
  action?: ReactNode
}) {
  const names = [...new Set(from)]
  const sub = names.length === 0 ? 'Reconciled across connected records' : names.length <= 2 ? `Documented by ${names.join(' & ')}` : `Documented by ${names.length} clinicians`
  return (
    <Card
      icon={icon}
      title={
        <>
          {title}
          {count !== undefined && <span className="badge num">{count}</span>}
        </>
      }
      sub={sub}
      action={action}
    >
      {count === 0 ? <div className="empty">Nothing documented yet</div> : children}
    </Card>
  )
}

const SOURCE_LABEL: Record<RecordSource['system_type'], string> = {
  ehr: 'EHR',
  patient_portal: 'Patient portal',
  lab: 'Lab',
  imaging: 'Imaging',
  pharmacy: 'Pharmacy',
}

export function ConnectedSources({ sources }: { sources: RecordSource[] }) {
  return (
    <section className="card" aria-labelledby="sources-h">
      <header className="card-header">
        <div>
          <h2 className="card-title" id="sources-h"><Icon name="link" size={16} /> Record sources</h2>
          <div className="card-sub">Authorized by the patient</div>
        </div>
      </header>
      <ul className="list">
        {sources.map((s) => (
          <li key={s.source_id}>
            <span className={`badge ${s.status === 'connected' ? 'badge-good' : s.status === 'error' ? 'badge-stalled' : 'badge-info'}`}>
              <Icon name={s.status === 'connected' ? 'check' : s.status === 'error' ? 'alert' : 'clock'} size={12} />
              {s.status === 'connected' ? 'Connected' : s.status === 'error' ? 'Error' : 'Syncing'}
            </span>
            <div className="list-main">
              <div className="list-title">{s.name}</div>
              <div className="list-meta">
                {SOURCE_LABEL[s.system_type]} · synced {formatSyncTime(s.last_synced_at)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
