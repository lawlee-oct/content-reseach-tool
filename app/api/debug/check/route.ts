import { jobStore } from '../../../lib/job-store'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const jobId = url.searchParams.get('jobId')
  
  if (!jobId) {
    return new Response(JSON.stringify({ error: 'Missing jobId' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
  
  const job = (jobStore as any).getJob(jobId)
  
  return new Response(JSON.stringify({
    jobId,
    exists: !!job,
    status: job?.status || null,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
