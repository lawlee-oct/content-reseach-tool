// ─── Input ───────────────────────────────────────────────────────────────────

export type ResearchInput =
  | { type: 'text'; value: string; maxUrls?: number }   // "best smart home devices"
  | { type: 'url'; value: string; maxUrls?: number }    // "https://example.com"

// ─── Agent 1 — Competitor Discovery ─────────────────────────────────────────

export interface CompetitorResult {
  domains: string[]
  blogUrls: string[]
  seedKeywords: string[]
}

// ─── Agent 2 — Content Crawler ───────────────────────────────────────────────

export interface CrawledArticle {
  url: string
  domain: string
  title: string
  h1: string
  h2s: string[]
  h3s: string[]
  metaDesc: string
  wordCount: number
  canonical: string
  internalLinkCount: number
  structureHints: StructureHint[]
  crawledAt: string
}

export type StructureHint =
  | 'best-list'
  | 'how-to'
  | 'review'
  | 'comparison'
  | 'guide'
  | 'roundup'
  | 'listicle'
  | 'news'
  | 'case-study'
  | 'faq'
  | 'other'

// ─── Agent 3 — Pattern Analyzer ──────────────────────────────────────────────

export interface BlogPattern {
  id: string
  name: string                    // "Best [Product] Under $X"
  titleTemplate: string           // "Best {product} Under ${price} in {year}"
  frequency: number               // số bài trong dataset khớp pattern này
  frequencyPct: number            // % trong tổng số bài
  seoScore: number                // 1–10, Claude đánh giá tiềm năng SEO
  avgWordCount: number
  dominantH2Pattern: string       // "Top picks → Buying guide → FAQ"
  exampleUrls: string[]           // tối đa 3 URL thực từ dataset
  exampleTitles: string[]         // tối đa 3 title thực
  structureHints: StructureHint[]
}

export interface PatternAnalysisResult {
  totalArticlesAnalyzed: number
  patterns: BlogPattern[]
  topDomains: { domain: string; articleCount: number }[]
  analysisNotes: string
}

// ─── Agent 4 — Report Generator ──────────────────────────────────────────────

export interface BlogTypeReport {
  patternId: string
  patternName: string
  titleTemplate: string
  titleExamples: string[]         // 3 title mẫu sẵn sàng dùng
  recommendedWordCount: string    // "1500–2500 words"
  headingStructure: HeadingStructure
  seoNotes: string
  contentTips: string[]
  exampleUrls: string[]
  seoScore: number
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface HeadingStructure {
  h1: string
  h2s: string[]
  notes: string
}

export interface FinalReport {
  input: ResearchInput
  generatedAt: string
  summary: string
  totalArticlesAnalyzed: number
  topCompetitors: string[]
  blogTypes: BlogTypeReport[]
}

// ─── Job / SSE ───────────────────────────────────────────────────────────────

export type JobStatus =
  | 'pending'
  | 'discovering'
  | 'crawling'
  | 'analyzing'
  | 'reporting'
  | 'done'
  | 'error'

export interface JobProgress {
  jobId: string
  status: JobStatus
  step: number          // 1–4
  totalSteps: number    // 4
  message: string
  progress: number      // 0–100
  data?: Partial<{
    competitorResult: CompetitorResult
    crawledArticles: CrawledArticle[]
    patternResult: PatternAnalysisResult
    finalReport: FinalReport
  }>
  error?: string
}
