// Job Runner — orchestrate tất cả 4 agents
// Chạy tuần tự, emit progress qua callback

import { runDiscoveryAgent } from './agent1-discovery'
import { runCrawlerAgent } from './agent2-crawler'
import { runPatternAnalyzerAgent } from './agent3-analyzer'
import { runReportGeneratorAgent } from './agent4-report'
import { ResearchInput, JobProgress, FinalReport } from '../../types'

export type ProgressCallback = (progress: JobProgress) => void

// ─── Main Runner ──────────────────────────────────────────────────────────────

export async function runResearchJob(
  jobId: string,
  input: ResearchInput,
  onProgress: ProgressCallback
): Promise<FinalReport> {

  const emit = (
    status: JobProgress['status'],
    step: number,
    message: string,
    progressPct: number,
    data?: JobProgress['data']
  ) => {
    onProgress({
      jobId,
      status,
      step,
      totalSteps: 4,
      message,
      progress: progressPct,
      data,
    })
  }

  // ─── AGENT 1: Discovery ───────────────────────────────────────────────────
  emit('discovering', 1, 'Đang tìm competitor domains và blog URLs...', 5)

  const competitorResult = await runDiscoveryAgent(input, (msg) => {
    emit('discovering', 1, msg, 10)
  })

  emit('discovering', 1,
    `Tìm thấy ${competitorResult.domains.length} domains, ${competitorResult.blogUrls.length} blog URLs`,
    25,
    { competitorResult }
  )

  if (competitorResult.blogUrls.length === 0) {
    throw new Error('Không tìm thấy blog URLs nào. Thử input khác hoặc kiểm tra SERPAPI_KEY.')
  }

  // ─── AGENT 2: Crawler ─────────────────────────────────────────────────────
  emit('crawling', 2, `Crawling ${competitorResult.blogUrls.length} bài blog...`, 28)

  const crawledArticles = await runCrawlerAgent(
    competitorResult.blogUrls,
    (msg, done, total) => {
      const crawlProgress = 28 + Math.round((done / total) * 22)
      emit('crawling', 2, msg, crawlProgress)
    }
  )

  emit('crawling', 2,
    `Crawl xong: ${crawledArticles.length}/${competitorResult.blogUrls.length} bài thành công`,
    50,
    { competitorResult, crawledArticles }
  )

  if (crawledArticles.length < 5) {
    throw new Error(`Chỉ crawl được ${crawledArticles.length} bài. Không đủ dữ liệu để phân tích.`)
  }

  // ─── AGENT 3: Pattern Analyzer ───────────────────────────────────────────
  emit('analyzing', 3, 'Đang phân tích patterns với Gemini AI...', 52)

  const patternResult = await runPatternAnalyzerAgent(
    crawledArticles,
    (msg) => emit('analyzing', 3, msg, 60)
  )

  emit('analyzing', 3,
    `Tìm thấy ${patternResult.patterns.length} blog patterns`,
    75,
    { competitorResult, crawledArticles, patternResult }
  )

  // ─── AGENT 4: Report Generator ───────────────────────────────────────────
  emit('reporting', 4, 'Đang tạo báo cáo chi tiết...', 78)

  const finalReport = await runReportGeneratorAgent(
    patternResult,
    input,
    (msg) => emit('reporting', 4, msg, 88)
  )

  emit('done', 4,
    `Hoàn tất! ${finalReport.blogTypes.length} blog types sẵn sàng`,
    100,
    { competitorResult, crawledArticles, patternResult, finalReport }
  )

  return finalReport
}
