import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { availableDays, formatDay, formatTime } from '../lib/scheduling'
import { mockProviders } from '../mocks/record'
import { renderApp } from './renderApp'

const byId = (id: string) => mockProviders.find((p) => p.provider_id === id)!

describe('Appointment slots', () => {
  it('start after the wait and follow the provider’s hours', () => {
    const okafor = availableDays(byId('prov-alt-best'), '2025-12-17')
    expect(okafor[0].date).toBe('2025-12-29')
    expect(okafor[0].slots.map((s) => s.time)).toEqual(['13:30', '15:00', '17:30', '18:30'])
    expect(okafor.map((d) => d.date)).toEqual(['2025-12-29', '2025-12-30', '2026-01-02', '2026-01-05']) // skips Dec 31 and Jan 1
    const kim = availableDays(byId('prov-pfpt-madison'), '2025-12-17') // evenings + weekends
    for (const d of kim) expect(d.slots.every((x) => ['17:30', '18:30', '10:00', '11:30'].includes(x.time))).toBe(true)
  })

  it('shows some times as already booked, the same on every run, never a fully booked day', () => {
    for (const p of mockProviders) {
      const a = availableDays(p, '2025-12-17')
      expect(a).toEqual(availableDays(p, '2025-12-17'))
      for (const d of a) expect(d.slots.some((x) => !x.booked)).toBe(true)
    }
    const all = mockProviders.flatMap((p) => availableDays(p, '2025-12-17').flatMap((d) => d.slots))
    const share = all.filter((x) => x.booked).length / all.length
    expect(share).toBeGreaterThan(0.2)
    expect(share).toBeLessThan(0.6)
  })

  it('formats times and days', () => {
    expect(formatTime('09:00')).toBe('9:00 AM')
    expect(formatTime('17:30')).toBe('5:30 PM')
    expect(formatTime('12:15')).toBe('12:15 PM')
    expect(formatDay('2025-12-29')).toBe('Mon, Dec 29')
  })
})

describe('Pregnancy', () => {
  it('can be turned on in care preferences and marks experienced clinicians', async () => {
    const user = userEvent.setup()
    renderApp('/access?journey=jr-specialist&show=options')
    const prefs = (await screen.findByRole('heading', { name: /your care preferences/i }, { timeout: 3000 })).closest('section')!
    await user.click(within(prefs).getByRole('button', { name: /edit preferences/i }))
    await user.click(within(prefs).getByRole('checkbox', { name: /i'm pregnant/i }))
    await user.click(within(prefs).getByRole('button', { name: /save and re-rank/i }))
    expect(await within(prefs).findByText(/pregnant · clinicians and travel adjusted/i, {}, { timeout: 3000 })).toBeInTheDocument()
    await waitFor(() => {
      const best = screen.getAllByRole('article', { name: /provider option/i })[0]
      expect(within(best).getByText(/pregnancy experience/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('asks the access map for pregnancy-aware routes', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_HERA_MAP_URL', 'http://map.test')
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      return new Response(JSON.stringify({ destination: 'x', appointment_date: '2025-12-29', options: [] }), { status: 200 })
    }))
    const { api } = await import('../api/client')
    await api.getRouteOptions('maya-001', 'j1', 'prov-alt-best', true)
    expect(new URL(urls[0]).searchParams.get('pregnant')).toBe('1')
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
})
