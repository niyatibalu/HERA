import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { MAP_URL } from '../api/client'

type Mode = 'compact' | 'full'

/**
 * Embeds the interactive access map (map/, served by the access-map service) inside the app.
 * Renders nothing when the map service isn't configured or doesn't answer, so the page falls
 * back to route cards alone. `routeId` highlights a route without reloading the frame, and
 * clicks on a route in the map come back through `onRouteSelect`.
 */
export function AccessMapFrame({
  patientId,
  providerId,
  routeId,
  onRouteSelect,
  mode = 'compact',
  height = 320,
  title = 'Map of routes to care',
  fallback = null,
}: {
  patientId: string
  providerId?: string
  routeId?: string
  onRouteSelect?: (routeId: string) => void
  mode?: Mode
  height?: number | string
  title?: string
  /** Shown instead of the map when the service isn't configured or doesn't answer. */
  fallback?: ReactNode
}) {
  const [status, setStatus] = useState<'checking' | 'up' | 'down'>(MAP_URL ? 'checking' : 'down')
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!MAP_URL) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2500)
    fetch(`${MAP_URL}/health`, { signal: ctrl.signal })
      .then((r) => setStatus(r.ok ? 'up' : 'down'))
      .catch(() => setStatus('down'))
      .finally(() => clearTimeout(timer))
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [])

  // routeId is deliberately left out of the src so selecting a route doesn't reload the map.
  const [initialRoute] = useState(routeId)
  const src = useMemo(() => {
    if (!MAP_URL) return ''
    const q = new URLSearchParams({ patient_id: patientId, theme: 'light' })
    q.set(mode === 'compact' ? 'embed' : 'inapp', '1')
    if (providerId) q.set('provider_id', providerId)
    if (initialRoute) q.set('route', initialRoute)
    return `${MAP_URL}/map/?${q}`
  }, [patientId, providerId, mode, initialRoute])

  useEffect(() => {
    if (routeId) frame.current?.contentWindow?.postMessage({ source: 'hera-app', type: 'selectRoute', route_id: routeId }, '*')
  }, [routeId])

  useEffect(() => {
    if (!onRouteSelect || !MAP_URL) return
    const origin = new URL(MAP_URL).origin
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.data?.source !== 'hera-map' || e.data?.type !== 'routeSelected') return
      if (typeof e.data.route_id === 'string') onRouteSelect(e.data.route_id)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onRouteSelect])

  if (status === 'checking') return null
  if (status === 'down') return <>{fallback}</>
  return <iframe ref={frame} className={`map-frame map-frame-${mode}`} src={src} title={title} style={{ height }} loading="lazy" />
}
