import { jobStore } from '../../../lib/job-store'

export async function GET() {
  const jobId = (jobStore as any).createJob({ type: 'text', value: 'test' })
  const job = (jobStore as any).getJob(jobId)
  
  return new Response(JSON.stringify({
    created: jobId,
    exists: !!job,
    job,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
