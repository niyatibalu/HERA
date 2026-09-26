// Derives the displayed care-journey steps from a backend CareJourney (state + state_history).
import type { CareJourney, CareState } from '../types'
import { daysBetween, humanize } from './format'

export type StepStatus = 'complete' | 'in_progress' | 'stalled' | 'pending'

export interface JourneyStep {
  state: CareState
  label: string
  status: StepStatus
  date?: string
  note?: string | null
}

/** Steps shown to the patient, in order. `followup_required` folds into the follow-up step. */
export const DISPLAY_STEPS: { state: CareState; label: string }[] = [
  { state: 'need_identified', label: 'Need identified' },
  { state: 'provider_matched', label: 'Provider matched' },
  { state: 'records_ready', label: 'Records shared' },
  { state: 'appointment_scheduled', label: 'Appointment scheduled' },
  { state: 'travel_planned', label: 'Travel planned' },
  { state: 'appointment_completed', label: 'Appointment completed' },
  { state: 'followup_completed', label: 'Follow-up complete' },
]

const ORDER: CareState[] = [
  'need_identified',
  'provider_matched',
  'records_ready',
  'appointment_scheduled',
  'travel_planned',
  'appointment_completed',
  'followup_required',
  'followup_completed',
]

/** The furthest forward state actually reached (ignores the `stalled` marker state). */
export function reachedState(j: CareJourney): CareState {
  if (j.state !== 'stalled') return j.state
  const real = [...j.state_history].reverse().find((t) => t.state !== 'stalled')
  return real?.state ?? 'need_identified'
}

export function journeySteps(j: CareJourney): JourneyStep[] {
  const reachedIdx = ORDER.indexOf(reachedState(j))
  const isStalled = j.stalled || j.state === 'stalled'
  const history = new Map(j.state_history.map((t) => [t.state, t]))
  let nextAssigned = false
  return DISPLAY_STEPS.map(({ state, label }) => {
    const idx = ORDER.indexOf(state)
    const t = history.get(state)
    if (idx <= reachedIdx) return { state, label, status: 'complete' as const, date: t?.entered_at, note: t?.note }
    if (!nextAssigned) {
      nextAssigned = true
      const followNote = state === 'followup_completed' ? history.get('followup_required')?.note : undefined
      return { state, label, status: isStalled ? ('stalled' as const) : ('in_progress' as const), note: followNote }
    }
    return { state, label, status: 'pending' as const }
  })
}

export function isComplete(j: CareJourney) {
  return reachedState(j) === 'followup_completed'
}

/** Days since the journey last moved forward. */
export function daysInState(j: CareJourney, today: string) {
  const last = j.state_history[j.state_history.length - 1]
  return last ? daysBetween(last.entered_at, today) : 0
}

export function currentStep(j: CareJourney) {
  return journeySteps(j).find((s) => s.status !== 'complete')
}

const STALL_TITLE: Partial<Record<CareState, string>> = {
  provider_matched: 'No provider matched',
  records_ready: 'Records not shared',
  appointment_scheduled: 'Appointment not scheduled',
  travel_planned: 'Travel not planned',
  appointment_completed: 'Appointment not completed',
  followup_completed: 'Follow-up not completed',
}

export interface AttentionItem {
  id: string
  tone: 'stalled' | 'review'
  title: string
  detail: string
  journey_id: string
  action: { label: string; to: string }
}

/** Care items needing the patient's attention: stalled pathways first, then travel planning. */
export function attentionItems(journeys: CareJourney[], today: string): AttentionItem[] {
  const out: AttentionItem[] = []
  for (const j of journeys) {
    const step = currentStep(j)
    if (!step) continue
    if (step.status === 'stalled') {
      out.push({
        id: j.journey_id,
        tone: 'stalled',
        title: `${/specialist/i.test(j.need) && step.state === 'appointment_scheduled' ? 'Specialist appointment not scheduled' : STALL_TITLE[step.state] ?? `${step.label} stalled`} after ${daysInState(j, today)} days`,
        detail: j.stalled_reason ?? `${j.need} has not moved forward.`,
        journey_id: j.journey_id,
        action: { label: 'Find better options', to: `/access?journey=${j.journey_id}&show=options` },
      })
    } else if (j.stall_warning) {
      out.push({
        id: j.journey_id,
        tone: 'review',
        title: `${humanize(j.need)} is at risk of stalling`,
        detail: j.stall_warning,
        journey_id: j.journey_id,
        action: { label: 'Find better options', to: `/access?journey=${j.journey_id}&show=options` },
      })
    } else if (step.state === 'travel_planned') {
      out.push({
        id: j.journey_id,
        tone: 'review',
        title: `Plan travel for your ${humanize(j.need).toLowerCase()}`,
        detail: 'Winter weather is possible. Compare safer routes and alternatives.',
        journey_id: j.journey_id,
        action: { label: 'Compare routes', to: `/journey#travel-${j.journey_id}` },
      })
    }
  }
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'stalled' ? -1 : 1))
}
