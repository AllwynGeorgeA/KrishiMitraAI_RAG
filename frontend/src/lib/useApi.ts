import { useCallback, useEffect, useState } from 'react'

/** Minimal fetch-on-mount hook: { data, error, loading, reload }. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const run = useCallback(fn, deps)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await run())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [run])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, error, loading, reload }
}
