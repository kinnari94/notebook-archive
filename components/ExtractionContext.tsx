'use client'
import { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react'

export interface LogLine { msg: string; level: string; ts: string }
export interface ExtractionProgress { done: number; total: number }

interface ExtractionState {
  running: boolean
  logs: LogLine[]
  progress: ExtractionProgress | null
  minimized: boolean
}

interface ExtractionContextValue extends ExtractionState {
  start: (payload: object) => void
  minimize: () => void
  restore: () => void
  clear: () => void
}

const ExtractionContext = createContext<ExtractionContextValue | null>(null)

export function ExtractionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ExtractionState>({
    running: false,
    logs: [],
    progress: null,
    minimized: false,
  })
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(async (payload: object) => {
    if (state.running) return
    abortRef.current = new AbortController()
    setState({ running: true, logs: [], progress: null, minimized: false })

    try {
      const res = await fetch('/api/extract/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      })
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.replace(/^data:\s*/, '').trim()
          if (!line) continue
          try {
            const ev = JSON.parse(line)
            if (ev.msg) {
              setState(p => ({ ...p, logs: [...p.logs, { msg: ev.msg, level: ev.level || 'info', ts: new Date().toLocaleTimeString() }] }))
            }
            if (ev.progress !== undefined) {
              setState(p => ({ ...p, progress: { done: ev.progress, total: ev.total } }))
            }
            if (ev.totalDelta !== undefined) {
              setState(p => ({
                ...p,
                progress: p.progress
                  ? { ...p.progress, total: p.progress.total + ev.totalDelta }
                  : null,
              }))
            }
          } catch { /* skip */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setState(p => ({ ...p, logs: [...p.logs, { msg: `Error: ${e}`, level: 'error', ts: new Date().toLocaleTimeString() }] }))
      }
    } finally {
      setState(p => ({ ...p, running: false }))
    }
  }, [state.running])

  const minimize = useCallback(() => setState(p => ({ ...p, minimized: true })), [])
  const restore  = useCallback(() => setState(p => ({ ...p, minimized: false })), [])
  const clear    = useCallback(() => setState({ running: false, logs: [], progress: null, minimized: false }), [])

  return (
    <ExtractionContext.Provider value={{ ...state, start, minimize, restore, clear }}>
      {children}
    </ExtractionContext.Provider>
  )
}

export function useExtraction() {
  const ctx = useContext(ExtractionContext)
  if (!ctx) throw new Error('useExtraction must be used within ExtractionProvider')
  return ctx
}
