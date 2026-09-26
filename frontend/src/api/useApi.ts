import { useCallback, useEffect, useState } from 'react'
import { subscribe, type ApiResult, type DataSource } from './client'

interface State<T> {
  data?: T
  source?: DataSource
  loading: boolean
  error?: string
}

/** Loads an API resource per `key`, and reloads whenever the client reports a mutation. */
export function useApi<T>(load: () => Promise<ApiResult<T>>, key: string) {
  const [state, setState] = useState<State<T>>({ loading: true })
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => subscribe(reload), [reload])

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    load()
      .then((r) => !cancelled && setState({ data: r.data, source: r.source, loading: false }))
      .catch((e: unknown) => !cancelled && setState((s) => ({ ...s, loading: false, error: String(e) })))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce])

  return { ...state, reload }
}
