import type { AvailabilitySlot } from '../types'

export const SLOT_LABEL: Record<AvailabilitySlot, string> = {
  weekday_morning: 'Weekday mornings',
  weekday_afternoon: 'Weekday afternoons',
  weekday_evening: 'Weekday evenings',
  weekend: 'Weekends',
}

/** Expertise a patient can ask for, with plain-language labels. Values match provider expertise_tags. */
export const EXPERTISE_OPTIONS: { value: string; label: string }[] = [
  { value: 'chronic_pelvic_pain', label: 'Chronic pelvic pain' },
  { value: 'endometriosis', label: 'Endometriosis' },
  { value: 'pelvic_floor_dysfunction', label: 'Pelvic floor therapy' },
  { value: 'pain_management', label: 'Pain management' },
  { value: 'reproductive_endocrinology', label: 'Fertility & hormones' },
  { value: 'urogynecology', label: 'Bladder & urogynecology' },
  { value: 'general_gynecology', label: 'General gynecology' },
  { value: 'lgbtq_care', label: 'LGBTQ+ affirming care' },
]
const TAG_LABEL: Record<string, string> = { pcos: 'PCOS', lgbtq_care: 'LGBTQ+ affirming care', minimally_invasive_surgery: 'Minimally invasive surgery' }
export const expertiseLabel = (v: string) =>
  EXPERTISE_OPTIONS.find((o) => o.value === v)?.label ?? TAG_LABEL[v] ?? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ')
