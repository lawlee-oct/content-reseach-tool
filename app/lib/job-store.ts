// Job Store — in-memory (development / single-instance)
// Production: thay bằng Redis + BullMQ (xem README phần Scale)

import { ResearchInput, JobProgress } from '../types'
import { runResearchJob } from '../lib/agents/job-runner'

interface Job {
  id: string
  input: ResearchInput
  status: 'pending' | 'running' | 'done' | 'error'
  lastProgress: JobProgress
  createdAt: number
}

// Singleton store
const jobs = new Map<string, Job>()
const runningCallbacks = new Map<string, ((p: JobProgress) => void)[]>()

// Tự dọn job cũ sau 1 giờ
const JOB_TTL_MS = 60 * 60 * 1000

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function cleanup() {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      jobs.delete(id)
      runningCallbacks.delete(id)
    }
  }
}

export const jobStore = {
  createJob(input: ResearchInput): string {
    cleanup()
    const id = generateJobId()

    const initialProgress: JobProgress = {
      jobId: id,
      status: 'pending',
      step: 0,
      totalSteps: 4,
      message: 'Job khởi tạo, đang chờ bắt đầu...',
      progress: 0,
    }

    jobs.set(id, {
      id,
      input,
      status: 'pending',
      lastProgress: initialProgress,
      createdAt: Date.now(),
    })

    return id
  },

  // Trả về true nếu job được start, false nếu không tồn tại hoặc đã chạy
  startJob(jobId: string, onProgress: (p: JobProgress) => void): boolean {
    const job = jobs.get(jobId)
    if (!job || job.status === 'running') return false

    job.status = 'running'

    // Lưu callback để nhiều SSE connection cùng nhận (nếu reconnect)
    if (!runningCallbacks.has(jobId)) {
      runningCallbacks.set(jobId, [])
    }
    runningCallbacks.get(jobId)!.push(onProgress)

    // Emit đến tất cả listeners
    const emitAll = (progress: JobProgress) => {
      job.lastProgress = progress
      for (const cb of runningCallbacks.get(jobId) ?? []) {
        cb(progress)
      }
    }

    // Chạy async, không block
    runResearchJob(jobId, job.input, emitAll)
      .then(() => {
        job.status = 'done'
        runningCallbacks.delete(jobId)
      })
      .catch((err: Error) => {
        job.status = 'error'
        emitAll({
          jobId,
          status: 'error',
          step: job.lastProgress.step,
          totalSteps: 4,
          message: 'Lỗi xảy ra',
          progress: job.lastProgress.progress,
          error: err.message,
        })
        runningCallbacks.delete(jobId)
      })

    return true
  },

  getJob(jobId: string): Job | undefined {
    return jobs.get(jobId)
  },
}
