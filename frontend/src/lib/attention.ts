import type { CareJourney } from '../types'

export interface AttentionItem {
  id: string
  tone: 'stalled' | 'review'
  title: string
  detail: string
  journey_id: string
}

/** Care items that need the patient's attention: stalled steps first, then steps in progress with a due date. */
export function attentionItems(journeys: CareJourney[]): AttentionItem[] {
  const stalled: AttentionItem[] = []
  const inProgress: AttentionItem[] = []
  for (const j of journeys) {
    for (const s of j.steps) {
      if (s.status === 'stalled') {
        stalled.push({
          id: `${j.journey_id}:${s.step_id}`,
          tone: 'stalled',
          title: s.key === 'appointment_scheduled' ? `${j.care_need} not yet scheduled` : `${j.care_need}: ${s.label.toLowerCase()} stalled`,
          detail: s.detail ?? (s.stalled_days ? `No progress for ${s.stalled_days} days.` : 'No recent progress.'),
          journey_id: j.journey_id,
        })
      } else if (s.status === 'in_progress' && s.due_date) {
        inProgress.push({
          id: `${j.journey_id}:${s.step_id}`,
          tone: 'review',
          title: s.key === 'travel_planned' ? `Plan travel for ${j.care_need.split(' — ')[0].toLowerCase()}` : `${s.label}: ${j.care_need.split(' — ')[0].toLowerCase()}`,
          detail: s.detail ?? '',
          journey_id: j.journey_id,
        })
      }
    }
  }
  return [...stalled, ...inProgress]
}
