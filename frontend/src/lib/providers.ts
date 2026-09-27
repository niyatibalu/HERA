// Presentation helpers over the backend's ranked ProviderMatch list.
import type { CareJourney, HealthEvent, Provider, ProviderMatch, ProviderOptions } from '../types'
import { ORIGINAL_REFERRAL_PROVIDER_ID } from '../mocks/care'

const LANGUAGE: Record<string, string> = { en: 'English', es: 'Spanish' }

/** "Speaks es" → "Speaks Spanish"; "Specialty match: chronic pelvic pain" stays readable. */
export function prettyReason(text: string) {
  return text.replace(/\b(en|es)\b/g, (code) => LANGUAGE[code] ?? code)
}

/** Specialty the care need is for: the newest open referral, else a sensible default. */
export function requiredSpecialty(events: HealthEvent[]) {
  const open = events.filter((e) => e.event_type === 'referral' && e.status !== 'completed').sort((a, b) => b.event_date.localeCompare(a.event_date))
  return open[0]?.specialty ?? 'chronic_pelvic_pain'
}

/**
 * Original referral vs. better options. Excludes primary care and clinicians who already evaluated
 * this topic without resolution, since the patient is being referred onward from them.
 */
export function buildProviderOptions(journey: CareJourney, matches: ProviderMatch[], events: HealthEvent[]): ProviderOptions {
  const originalId = originalReferralId(journey, matches.map((m) => m.provider))
  const original = matches.find((m) => m.provider.provider_id === originalId)
  const alreadySeen = new Set(events.filter((e) => e.event_type === 'encounter' && e.provider_id).map((e) => e.provider_id))
  const floor = original?.score ?? 0
  const alternatives = matches
    .filter((m) => m.provider.provider_id !== originalId && m.provider.specialty !== 'primary_care' && !alreadySeen.has(m.provider.provider_id) && m.score > floor)
    .sort((a, b) => b.score - a.score)
  return {
    journey_id: journey.journey_id,
    need: journey.need,
    original,
    barriers: original?.access_tradeoffs ?? [],
    alternatives,
  }
}

export const REMATCH_NOTE_PREFIX = 'Re-matched by HERA to'

/** Where the referral was first sent: the first non-HERA match in the history, else the known demo referral. */
export function originalReferralId(journey: CareJourney, providers: Provider[]) {
  const first = journey.state_history.find((t) => t.state === 'provider_matched' && !t.note?.startsWith(REMATCH_NOTE_PREFIX))
  return providers.find((p) => first?.note?.includes(p.name))?.provider_id ?? ORIGINAL_REFERRAL_PROVIDER_ID
}

/** The journey's current provider: provider_id, or (for journeys recorded before /advance accepted it) the provider named in the latest matching note. */
export function journeyProviderId(journey: CareJourney, providers: Provider[]) {
  if (journey.provider_id) return journey.provider_id
  const note = [...journey.state_history].reverse().find((t) => t.state === 'provider_matched')?.note ?? ''
  return providers.find((p) => note.includes(p.name))?.provider_id
}

/** The appointment date: appointment_date, or (for older journeys) the ISO date in the scheduling note. */
export function journeyAppointmentDate(journey: CareJourney) {
  if (journey.appointment_date) return journey.appointment_date
  // No stored date: only trust an older "booked for" note if the journey hasn't moved back
  // before booking since (a cancelled appointment returns it to records_ready).
  const last = [...journey.state_history].reverse().find((t) => t.state !== 'stalled')?.state
  if (!last || ['need_identified', 'provider_matched', 'records_ready'].includes(last)) return undefined
  const note = [...journey.state_history].reverse().find((t) => t.state === 'appointment_scheduled')?.note ?? ''
  return note.match(/\d{4}-\d{2}-\d{2}/)?.[0]
}
