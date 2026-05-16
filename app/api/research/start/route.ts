// POST /api/research/start
// Body: { type: 'text' | 'url', value: string }
// Response: { jobId: string }
//
// Job chạy background, client dùng GET /api/research/stream/[jobId] để nhận SSE

import { NextRequest, NextResponse } from 'next/server'
import { ResearchInput } from '../../../types'
import { jobStore } from '../../../lib/job-store'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, value, maxUrls } = body

    // Validate input
    if (!type || !value) {
      return NextResponse.json(
        { error: 'Thiếu type hoặc value' },
        { status: 400 }
      )
    }

    if (type !== 'text' && type !== 'url') {
      return NextResponse.json(
        { error: 'type phải là "text" hoặc "url"' },
        { status: 400 }
      )
    }

    if (type === 'url') {
      try { new URL(value) } catch {
        return NextResponse.json(
          { error: 'URL không hợp lệ' },
          { status: 400 }
        )
      }
    }

    const input: ResearchInput = { type, value, maxUrls: typeof maxUrls === 'number' ? Math.max(1, Math.min(1000, Math.floor(maxUrls))) : undefined }
    const jobId = jobStore.createJob(input)

    // Trả về jobId ngay, job chạy async background
    return NextResponse.json({ jobId })

  } catch (err) {
    console.error('[/api/research/start]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
