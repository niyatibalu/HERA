import type { AvailabilitySlot } from '../types'

export const SLOT_LABEL: Record<AvailabilitySlot, string> = {
  weekday_morning: 'Weekday mornings',
  weekday_afternoon: 'Weekday afternoons',
  weekday_evening: 'Weekday evenings',
  weekend: 'Weekends',
}
