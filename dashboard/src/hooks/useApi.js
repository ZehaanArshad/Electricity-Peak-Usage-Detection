import { useState, useEffect, useCallback } from 'react'
import API_BASE from '../utils/apiBase'

export function useApi(endpoint, deps = []) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const fetchData = useCallback(async () => {
    if (!endpoint) return
    setLoading(true)
    setError(null)
    try {
      const url = `${API_BASE}${endpoint}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, ...deps])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
