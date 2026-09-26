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
  return { month: MONTHS[m - 1].toUpperCase(), year: String(y) }
}

export function formatCurrency(usd: number) {
  return `$${usd.toLocaleString('en-US')}`
}

export function daysBetween(fromIso: string, toIso: string) {
  const a = parseDate(fromIso)
  const b = parseDate(toIso)
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000)
}

export function formatSyncTime(iso: string) {
  const time = iso.slice(11, 16)
  return time ? `${formatDate(iso)}, ${time}` : formatDate(iso)
}
