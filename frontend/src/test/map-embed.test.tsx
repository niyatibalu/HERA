import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from './renderApp'

async function loadFrame(healthOk = true) {
  vi.resetModules()
  vi.stubEnv('VITE_HERA_MAP_URL', 'http://map.test')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"status":"ok"}', { status: healthOk ? 200 : 503 })))
  return (await import('../components/AccessMapFrame')).AccessMapFrame
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Access map in the app', () => {
  it('has an Access map page that explains how to connect when the map service is not configured', async () => {
    renderApp('/map')
    expect(await screen.findByRole('heading', { name: /reaching care, not just finding it/i })).toBeInTheDocument()
    expect(screen.getByText(/access map service not connected/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /access map/i })).toHaveAttribute('href', '/map')
  })

  it('embeds the compact map for the chosen provider', async () => {
    const AccessMapFrame = await loadFrame()
    render(<AccessMapFrame patientId="maya-001" providerId="prov-alt-best" routeId="alt-best-beltline" />)
    const frame = await screen.findByTitle(/map of routes to care/i)
    const src = new URL(frame.getAttribute('src')!)
    expect(src.origin + src.pathname).toBe('http://map.test/map/')
    expect(Object.fromEntries(src.searchParams)).toMatchObject({ patient_id: 'maya-001', provider_id: 'prov-alt-best', embed: '1', theme: 'light', route: 'alt-best-beltline' })
  })

  it('shows the fallback instead of a broken frame when the map service is down', async () => {
    const AccessMapFrame = await loadFrame(false)
    render(<AccessMapFrame patientId="maya-001" fallback={<p>map offline</p>} />)
    expect(await screen.findByText('map offline')).toBeInTheDocument()
    expect(screen.queryByTitle(/map of routes to care/i)).not.toBeInTheDocument()
  })

  it('passes route clicks from the map back to the app, only from the map origin', async () => {
    const AccessMapFrame = await loadFrame()
    const onRouteSelect = vi.fn()
    render(<AccessMapFrame patientId="maya-001" onRouteSelect={onRouteSelect} />)
    await screen.findByTitle(/map of routes to care/i)
    const post = (origin: string) =>
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { origin, data: { source: 'hera-map', type: 'routeSelected', route_id: 'r1' } }))
      })
    post('http://evil.test')
    expect(onRouteSelect).not.toHaveBeenCalled()
    post('http://map.test')
    expect(onRouteSelect).toHaveBeenCalledWith('r1')
  })
})
