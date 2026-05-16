// useResearch hook
// Dùng trong NextJS component để chạy research và nhận realtime progress

'use client'

import { useState, useCallback, useRef } from 'react'
import { ResearchInput, JobProgress, FinalReport } from '../types'

export type ResearchState = {
  status: 'idle' | 'running' | 'done' | 'error'
  progress: number
  step: number
  message: string
  report: FinalReport | null
  error: string | null
}

const initialState: ResearchState = {
  status: 'idle',
  progress: 0,
  step: 0,
  message: '',
  report: null,
  error: null,
}

export function useResearch() {
  const [state, setState] = useState<ResearchState>(initialState)
  const eventSourceRef = useRef<EventSource | null>(null)

  const startResearch = useCallback(async (input: ResearchInput) => {
    // Reset state
    setState({ ...initialState, status: 'running', message: 'Khởi tạo job...' })

    // Đóng SSE cũ nếu còn
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      // 1. Tạo job
      const res = await fetch('/api/research/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Không thể tạo job')
      }

      const { jobId } = await res.json()

      // 2. Kết nối SSE stream
      const es = new EventSource(`/api/research/stream/${jobId}`)
      eventSourceRef.current = es

      es.onmessage = (event) => {
        const payload = JSON.parse(event.data)

        if (payload.type === 'ping') return

        if (payload.type === 'error') {
          setState(prev => ({
            ...prev,
            status: 'error',
            error: payload.error,
          }))
          es.close()
          return
        }

        if (payload.type === 'progress') {
          const progress = payload as JobProgress & { type: string }

          setState(prev => ({
            ...prev,
            status: progress.status === 'done' ? 'done'
              : progress.status === 'error' ? 'error'
              : 'running',
            progress: progress.progress,
            step: progress.step,
            message: progress.message,
            report: progress.data?.finalReport ?? prev.report,
            error: progress.error ?? null,
          }))

          if (progress.status === 'done' || progress.status === 'error') {
            es.close()
          }
        }
      }

      es.onerror = () => {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Mất kết nối với server. Thử lại.',
        }))
        es.close()
      }

    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Lỗi không xác định',
      }))
    }
  }, [])

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    setState(initialState)
  }, [])

  return { state, startResearch, reset }
}
