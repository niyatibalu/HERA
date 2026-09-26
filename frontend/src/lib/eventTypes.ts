import type { EventType } from '../types'
import type { IconName } from '../components/Icon'

export const EVENT_TYPE_META: Record<EventType, { label: string; plural: string; icon: IconName }> = {
  encounter: { label: 'Visit', plural: 'Visits', icon: 'stethoscope' },
  symptom: { label: 'Symptom', plural: 'Symptoms', icon: 'user' },
  diagnosis: { label: 'Condition', plural: 'Conditions', icon: 'record' },
  lab: { label: 'Lab', plural: 'Labs', icon: 'lab' },
  medication: { label: 'Medication', plural: 'Medications', icon: 'pill' },
  imaging: { label: 'Imaging', plural: 'Imaging', icon: 'scan' },
  procedure: { label: 'Procedure', plural: 'Procedures', icon: 'check' },
  referral: { label: 'Referral', plural: 'Referrals', icon: 'arrow' },
}
