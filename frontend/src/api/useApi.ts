import { useCallback, useEffect, useState } from 'react'
import type { ApiResult, DataSource } from './client'

interface State<T> {
  data?: T
  source?: DataSource
  loading: boolean
  error?: string
}

/** Loads an API resource once per `key`; `reload` refetches. */
export function useApi<T>(load: () => Promise<ApiResult<T>>, key: string) {
  const [state, setState] = useState<State<T>>({ loading: true })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    load()
      .then((r) => !cancelled && setState({ data: r.data, source: r.source, loading: false }))
      .catch((e: unknown) => !cancelled && setState({ loading: false, error: String(e) }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}
