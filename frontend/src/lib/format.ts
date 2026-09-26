const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Parses YYYY-MM-DD (or ISO datetime) without timezone drift. */
export function parseDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return { y, m, d }
}

export function formatDate(iso: string, opts: { year?: boolean } = {}) {
  const { y, m, d } = parseDate(iso)
  return `${MONTHS[m - 1]} ${d}${opts.year ? `, ${y}` : ''}`
}

export function formatMonth(iso: string) {
  const { y, m } = parseDate(iso)
  return { month: MONTHS[m - 1].toUpperCase(), year: String(y), day: String(parseDate(iso).d).padStart(2, '0') }
}

export function monthKey(iso: string) {
  return iso.slice(0, 7)
}

export function monthLabel(key: string) {
  const { y, m } = parseDate(`${key}-01`)
  return `${MONTHS[m - 1]} ${y}`
}

export function formatCurrency(usd: number) {
  return `$${usd.toLocaleString('en-US')}`
}

const toUtc = (iso: string) => {
  const { y, m, d } = parseDate(iso)
  return Date.UTC(y, m - 1, d)
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86_400_000)
}

export function addDays(iso: string, days: number) {
  return new Date(toUtc(iso) + days * 86_400_000).toISOString().slice(0, 10)
}

export function monthsBetween(fromIso: string, toIso: string) {
  const a = parseDate(fromIso)
  const b = parseDate(toIso)
  return Math.max(0, Math.round((b.y - a.y) * 12 + (b.m - a.m) + (b.d - a.d) / 30))
}

export function formatSyncTime(iso: string) {
  const time = iso.slice(11, 16)
  return time ? `${formatDate(iso)}, ${time}` : formatDate(iso)
}

export function ageOn(dobIso: string, onIso: string) {
  const a = parseDate(dobIso)
  const b = parseDate(onIso)
  return b.y - a.y - ((b.m < a.m || (b.m === a.m && b.d < a.d)) ? 1 : 0)
}

/** "pelvic_pain" → "Pelvic pain" */
export function humanize(label: string) {
  const s = label.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const SPECIALTY: Record<string, string> = {
  primary_care: 'Primary care',
  obgyn: 'OB/GYN',
  gynecology: 'Gynecology',
  chronic_pelvic_pain: 'Chronic pelvic pain specialist',
  pelvic_floor_physical_therapy: 'Pelvic floor physical therapy',
  gynecologic_surgery: 'Gynecologic surgery',
  reproductive_endocrinology: 'Fertility & hormones',
  urogynecology: 'Urogynecology',
  pain_management: 'Pain management',
}
export function specialtyLabel(s?: string | null) {
  return s ? SPECIALTY[s] ?? humanize(s) : ''
}
