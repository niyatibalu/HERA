import type { ReactNode } from 'react'
import type { RecordSource } from '../types'
import { Card } from './common'
import type { IconName } from './Icon'
import { Icon } from './Icon'
import { formatSyncTime } from '../lib/format'

/** A section of the unified record, attributed to the connected systems it came from. */
export function ConnectedRecordCard({ title, icon, count, sources, children, action }: {
  title: string
  icon: IconName
  count?: number
  sources: RecordSource[]
  children: ReactNode
  action?: ReactNode
}) {
  const names = sources.map((s) => s.name)
  const sub = names.length === 0 ? 'Reconciled across all connected sources' : names.length <= 2 ? `From ${names.join(' & ')}` : `From ${names.length} connected sources`
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
      {children}
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
    <Card
      icon="link"
      title="Connected health records"
      sub="Authorized by the patient · simulated connection for this demo"
    >
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
                {SOURCE_LABEL[s.system_type]} · last synced {formatSyncTime(s.last_synced_at)}
                {s.simulated && ' · simulated'}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
