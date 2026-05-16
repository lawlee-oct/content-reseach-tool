// GET /api/research/stream/[jobId]
// Server-Sent Events — stream progress từng bước của job
// Client nhận: data: { jobId, status, step, progress, message, data? }

import { NextRequest } from 'next/server'
import { jobStore } from '../../../../lib/job-store'

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5 phút timeout cho Vercel Pro / self-hosted

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  if (!jobId) {
    return new Response('Missing jobId', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // Client đã disconnect
        }
      }

      // Ping ngay để giữ connection
      send({ type: 'ping', jobId })

      // Bắt đầu job nếu chưa chạy
      const wasStarted = jobStore.startJob(jobId, (progress) => {
        send({ type: 'progress', ...progress })

        // Đóng stream khi done hoặc error
        if (progress.status === 'done' || progress.status === 'error') {
          setTimeout(() => {
            try { controller.close() } catch {}
          }, 500)
        }
      })

      if (!wasStarted) {
        // Job không tồn tại hoặc đã chạy rồi
        const existing = jobStore.getJob(jobId)
        if (existing) {
          send({ type: 'progress', ...existing.lastProgress })
        } else {
          send({ type: 'error', error: `Job ${jobId} không tồn tại` })
        }
        try { controller.close() } catch {}
      }

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Tắt buffering trên Nginx
    },
  })
}
