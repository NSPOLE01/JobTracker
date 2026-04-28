import { useEffect, useRef, useCallback } from 'react'

export function useWebSocket(url, onMessage) {
  const ws          = useRef(null)
  const retryTimer  = useRef(null)
  const unmounted   = useRef(false)
  const retryDelay  = useRef(1000)

  const connect = useCallback(() => {
    if (unmounted.current) return

    try {
      ws.current = new WebSocket(url)
    } catch {
      return
    }

    ws.current.onopen = () => {
      retryDelay.current = 1000
    }

    ws.current.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)) } catch {}
    }

    ws.current.onclose = () => {
      if (unmounted.current) return
      retryTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, 30_000)
        connect()
      }, retryDelay.current)
    }

    ws.current.onerror = () => {
      ws.current?.close()
    }
  }, [url, onMessage])

  useEffect(() => {
    unmounted.current = false
    connect()
    return () => {
      unmounted.current = true
      clearTimeout(retryTimer.current)
      ws.current?.close()
    }
  }, [connect])
}
