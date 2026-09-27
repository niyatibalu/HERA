import type { AvailabilitySlot, Provider } from '../types'
import { addDays } from './format'

export interface Slot {
  date: string // YYYY-MM-DD
  time: string // HH:MM, 24h
}
export type Modality = 'in_person' | 'telehealth'
export interface Booking extends Slot {
  modality: Modality
}

const TIMES: Record<AvailabilitySlot, string[]> = {
  weekday_morning: ['09:00', '10:30'],
  weekday_afternoon: ['13:30', '15:00'],
  weekday_evening: ['17:30', '18:30'],
  weekend: ['10:00', '11:30'],
}
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay()
/** Clinics closed (month-day). */
const HOLIDAYS = new Set(['01-01', '07-04', '12-24', '12-25', '12-31'])

/**
 * Open appointment times for a provider (synthetic): from the first day after their wait,
 * on the days and times of day they offer, for the next `days` days that have openings.
 */
export function availableDays(provider: Provider, today: string, days = 4): { date: string; times: string[] }[] {
  const offered = provider.availability?.length ? provider.availability : (['weekday_morning', 'weekday_afternoon'] as AvailabilitySlot[])
  const out: { date: string; times: string[] }[] = []
  for (let i = 0; out.length < days && i < 60; i++) {
    const date = addDays(today, provider.wait_days + i)
    if (HOLIDAYS.has(date.slice(5))) continue
    const d = weekday(date)
    const isWeekend = d === 0 || d === 6
    const times = offered
      .filter((s) => (s === 'weekend') === isWeekend)
      .flatMap((s) => TIMES[s])
      .sort()
    if (times.length) out.push({ date, times })
  }
  return out
}

export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export function formatDay(iso: string) {
  const [, m, d] = iso.split('-').map(Number)
  return `${WEEKDAYS[weekday(iso)]}, ${MONTHS[m - 1]} ${d}`
}

export const modalityLabel = (m?: string | null) => (m === 'telehealth' ? 'Video visit' : 'In person')
