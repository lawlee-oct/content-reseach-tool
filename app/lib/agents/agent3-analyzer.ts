// Agent 3 — Pattern Analyzer
// Input : CrawledArticle[]
// Output: PatternAnalysisResult
//
// Dùng Google Gemini 1.5 Flash (free tier: 15 req/min, 1M tokens/day)

import { CrawledArticle, PatternAnalysisResult, BlogPattern, StructureHint } from '../../types'
import { callLLM } from '../agentUtils'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const GEMINI_MODELS = Array.from(new Set([GEMINI_MODEL]))
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 16384
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 180000

// Gemini free tier: 15 req/min → batch bài để tối ưu
const BATCH_SIZE = 60   // Gửi tối đa 60 bài/request để không vượt context limit

// ─── Main Entry ──────────────────────────────────────────────────────────────

export async function runPatternAnalyzerAgent(
  articles: CrawledArticle[],
  onProgress?: (msg: string) => void
): Promise<PatternAnalysisResult> {
  const log = onProgress ?? console.log

  log(`Analyzing ${articles.length} articles để tìm patterns...`)

  // Nếu nhiều hơn BATCH_SIZE, chia batch rồi merge
  if (articles.length <= BATCH_SIZE) {
    return analyzeInSingleBatch(articles, log)
  } else {
    return analyzeInMultipleBatches(articles, log)
  }
}

// ─── Single Batch ─────────────────────────────────────────────────────────────

async function analyzeInSingleBatch(
  articles: CrawledArticle[],
  log: (msg: string) => void
): Promise<PatternAnalysisResult> {
  log('Gửi batch phân tích đến Gemini...')
  const prompt = buildAnalysisPrompt(articles)
  const raw = await callGemini(prompt)
  log('Nhận kết quả từ Gemini, parsing...')
  return parseAnalysisResponse(raw, articles)
}

// ─── Multiple Batches ─────────────────────────────────────────────────────────

async function analyzeInMultipleBatches(
  articles: CrawledArticle[],
  log: (msg: string) => void
): Promise<PatternAnalysisResult> {
  const batches: CrawledArticle[][] = []
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    batches.push(articles.slice(i, i + BATCH_SIZE))
  }

  log(`Chia thành ${batches.length} batches...`)

  const batchResults: PatternAnalysisResult[] = []

  for (let i = 0; i < batches.length; i++) {
    log(`Phân tích batch ${i + 1}/${batches.length}...`)
    const prompt = buildAnalysisPrompt(batches[i])
    const raw = await callGemini(prompt)
    const result = parseAnalysisResponse(raw, batches[i])
    batchResults.push(result)

    // Rate limit: đợi 4s giữa các request để không vượt 15 req/min
    if (i < batches.length - 1) {
      await sleep(4000)
    }
  }

  log('Merging kết quả các batches...')
  return mergeBatchResults(batchResults, articles)
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildAnalysisPrompt(articles: CrawledArticle[]): string {
  // Compact format để tiết kiệm tokens
  const articleData = articles.map((a, i) => ({
    i: i + 1,
    title: a.title,
    h1: a.h1,
    h2s: a.h2s.slice(0, 6),
    wc: a.wordCount,
    url: a.url,
    hints: a.structureHints,
  }))

  return `You are an expert SEO content strategist. Analyze these ${articles.length} blog articles and identify recurring content patterns.

ARTICLES:
${JSON.stringify(articleData, null, 0)}

TASK:
Cluster these articles into 15-20 distinct blog post types/patterns. For each pattern:
1. Give it a clear name with placeholders (e.g., "Best [Product] Under $[Price]", "How to [Action] Without [Pain Point]")
2. Count how many articles match it
3. Score its SEO potential (1-10)
4. Note the typical H2 structure
5. List up to 3 example URLs from the data

IMPORTANT: Respond ONLY with valid JSON, no markdown, no explanation. Use this exact structure:
{
  "patterns": [
    {
      "id": "pattern-1",
      "name": "Best [Product] Under $[Price]",
      "titleTemplate": "Best {product} Under \${price} in {year}",
      "frequency": 12,
      "frequencyPct": 24,
      "seoScore": 8,
      "avgWordCount": 2200,
      "dominantH2Pattern": "Quick Picks → Detailed Reviews → Buying Guide → FAQ",
      "exampleUrls": ["https://..."],
      "exampleTitles": ["Best Wireless Earbuds Under $100 in 2025"],
      "structureHints": ["best-list", "review"]
    }
  ],
  "topDomains": [
    { "domain": "example.com", "articleCount": 15 }
  ],
  "analysisNotes": "Brief observation about the content landscape"
}`
}

// ─── Gemini API Call ──────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set. Falling back to structural analysis.')
    console.error('   To fix: Set GEMINI_API_KEY in .env.local or environment variables')
    console.error('   Get key at: https://aistudio.google.com/app/apikey')
    throw new Error('No Gemini API key configured. Set GEMINI_API_KEY in .env')
  }

  let lastError: Error | null = null
  let geminiTried = false

  for (const model of GEMINI_MODELS) {
    try {
      const text = await callGeminiModel(model, prompt)
      return text
    } catch (error) {
      geminiTried = true
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`⚠️ Gemini model ${model} failed: ${lastError.message}`)
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      console.warn('↪️ Falling back to OpenAI (OPENAI_API_KEY found)')
      return await callLLM(prompt, 4000)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`⚠️ Fallback LLM failed: ${lastError.message}`)
    }
  }

  const errorMsg = geminiTried 
    ? `Gemini API failed: ${lastError?.message}. No OpenAI fallback configured.`
    : 'No API key available. Set GEMINI_API_KEY or OPENAI_API_KEY.'
  
  throw new Error(errorMsg)
}

async function callGeminiModel(model: string, prompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini returned empty response or unexpected response shape')
  }
  return text
}

// ─── Response Parser ──────────────────────────────────────────────────────────

function parseAnalysisResponse(
  raw: string,
  articles: CrawledArticle[]
): PatternAnalysisResult {
  let parsed: any

  try {
    // Strip markdown nếu có
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    try {
      parsed = JSON.parse(cleaned)
    } catch (_e) {
      // Try to find and extract JSON object
      const extracted = extractJsonObject(cleaned)
      if (extracted) {
        parsed = JSON.parse(extracted)
      } else {
        // Try to repair truncated JSON by finding last complete object
        const repaired = repairTruncatedJson(cleaned)
        if (repaired) {
          parsed = JSON.parse(repaired)
        } else {
          throw _e
        }
      }
    }
  } catch (e) {
    console.error('⚠️ Failed to parse Gemini response (using fallback):')
    console.error(`   Raw length: ${raw.length} chars`)
    console.error(`   First 200 chars: ${raw.slice(0, 200)}...`)
    console.error(`   Last 200 chars: ...${raw.slice(-200)}`)
    console.error(`   Error: ${(e as Error).message}`)
    
    // Fallback: trả về kết quả basic từ structureHints
    return buildFallbackResult(articles)
  }

  const patterns: BlogPattern[] = (parsed.patterns ?? []).map((p: any, idx: number) => ({
    id: p.id ?? `pattern-${idx + 1}`,
    name: p.name ?? 'Unknown Pattern',
    titleTemplate: p.titleTemplate ?? p.name ?? '',
    frequency: Number(p.frequency) || 0,
    frequencyPct: Number(p.frequencyPct) || 0,
    seoScore: Math.min(10, Math.max(1, Number(p.seoScore) || 5)),
    avgWordCount: Number(p.avgWordCount) || 0,
    dominantH2Pattern: p.dominantH2Pattern ?? '',
    exampleUrls: Array.isArray(p.exampleUrls) ? p.exampleUrls.slice(0, 3) : [],
    exampleTitles: Array.isArray(p.exampleTitles) ? p.exampleTitles.slice(0, 3) : [],
    structureHints: Array.isArray(p.structureHints) ? p.structureHints as StructureHint[] : ['other'],
  }))

  const topDomains = Array.isArray(parsed.topDomains)
    ? parsed.topDomains.slice(0, 10)
    : buildTopDomains(articles)

  return {
    totalArticlesAnalyzed: articles.length,
    patterns: patterns.sort((a, b) => b.seoScore - a.seoScore),
    topDomains,
    analysisNotes: parsed.analysisNotes ?? '',
  }
}

// ─── Merge Multiple Batch Results ─────────────────────────────────────────────

function mergeBatchResults(
  results: PatternAnalysisResult[],
  allArticles: CrawledArticle[]
): PatternAnalysisResult {
  // Gộp tất cả patterns từ các batch, merge trùng tên
  const patternMap = new Map<string, BlogPattern>()

  for (const result of results) {
    for (const pattern of result.patterns) {
      const key = pattern.name.toLowerCase()
      if (patternMap.has(key)) {
        const existing = patternMap.get(key)!
        existing.frequency += pattern.frequency
        existing.exampleUrls = [...new Set([...existing.exampleUrls, ...pattern.exampleUrls])].slice(0, 3)
        existing.exampleTitles = [...new Set([...existing.exampleTitles, ...pattern.exampleTitles])].slice(0, 3)
        existing.seoScore = Math.round((existing.seoScore + pattern.seoScore) / 2)
      } else {
        patternMap.set(key, { ...pattern })
      }
    }
  }

  // Recalculate frequencyPct
  const totalArticles = allArticles.length
  const patterns = Array.from(patternMap.values()).map(p => ({
    ...p,
    frequencyPct: Math.round((p.frequency / totalArticles) * 100),
  }))

  return {
    totalArticlesAnalyzed: totalArticles,
    patterns: patterns.sort((a, b) => b.seoScore - a.seoScore).slice(0, 20),
    topDomains: buildTopDomains(allArticles),
    analysisNotes: results.map(r => r.analysisNotes).filter(Boolean).join(' | '),
  }
}

// ─── Fallback (nếu Gemini fail) ───────────────────────────────────────────────

function buildFallbackResult(articles: CrawledArticle[]): PatternAnalysisResult {
  const hintCount: Record<string, number> = {}
  for (const a of articles) {
    for (const h of a.structureHints) {
      hintCount[h] = (hintCount[h] ?? 0) + 1
    }
  }

  const patterns: BlogPattern[] = Object.entries(hintCount)
    .sort((a, b) => b[1] - a[1])
    .map(([hint, count], idx) => ({
      id: `pattern-${idx + 1}`,
      name: hintToName(hint as StructureHint),
      titleTemplate: hintToTemplate(hint as StructureHint),
      frequency: count,
      frequencyPct: Math.round((count / articles.length) * 100),
      seoScore: 7,
      avgWordCount: averageWordCount(articles),
      dominantH2Pattern: '',
      exampleUrls: articles.filter(a => a.structureHints.includes(hint as StructureHint)).slice(0, 3).map(a => a.url),
      exampleTitles: articles.filter(a => a.structureHints.includes(hint as StructureHint)).slice(0, 3).map(a => a.title),
      structureHints: [hint as StructureHint],
    }))

  return {
    totalArticlesAnalyzed: articles.length,
    patterns,
    topDomains: buildTopDomains(articles),
    analysisNotes: 'Fallback analysis based on structural hints (Gemini unavailable)',
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function buildTopDomains(articles: CrawledArticle[]) {
  const domainCount: Record<string, number> = {}
  for (const a of articles) {
    domainCount[a.domain] = (domainCount[a.domain] ?? 0) + 1
  }
  return Object.entries(domainCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, articleCount]) => ({ domain, articleCount }))
}

function averageWordCount(articles: CrawledArticle[]): number {
  if (articles.length === 0) return 0
  return Math.round(articles.reduce((s, a) => s + a.wordCount, 0) / articles.length)
}

function hintToName(hint: StructureHint): string {
  const map: Record<StructureHint, string> = {
    'best-list': 'Best [Product] List',
    'how-to': 'How to [Action]',
    'review': '[Product] Review',
    'comparison': '[Product A] vs [Product B]',
    'guide': 'Complete Guide to [Topic]',
    'roundup': '[Year] Roundup',
    'listicle': '[N] [Things] You Need to Know',
    'faq': 'FAQ: [Topic]',
    'case-study': 'Case Study: [Result]',
    'news': '[Topic] News Update',
    'other': 'General [Topic] Article',
  }
  return map[hint] ?? hint
}

function hintToTemplate(hint: StructureHint): string {
  const map: Record<StructureHint, string> = {
    'best-list': 'Best {product} in {year}: Top {n} Picks',
    'how-to': 'How to {action} (Step-by-Step Guide)',
    'review': '{product} Review: Is It Worth It in {year}?',
    'comparison': '{product_a} vs {product_b}: Which Should You Buy?',
    'guide': 'The Complete Guide to {topic} for Beginners',
    'roundup': 'Best {topic} Products of {year}: Our Top Picks',
    'listicle': '{n} {topic} Tips That Actually Work in {year}',
    'faq': '{n} Most Asked Questions About {topic} (Answered)',
    'case-study': 'How {entity} {achieved_result} with {method}',
    'news': '{topic}: What You Need to Know in {year}',
    'other': 'Everything You Need to Know About {topic}',
  }
  return map[hint] ?? hint
}

function extractJsonObject(input: string): string | null {
  const start = input.indexOf('{')
  const end = input.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const candidate = input.slice(start, end + 1)
  try {
    JSON.parse(candidate)
    return candidate
  } catch {
    return null
  }
}

// Try to repair truncated JSON by finding last complete pattern or object
function repairTruncatedJson(input: string): string | null {
  try {
    const start = input.indexOf('{')
    if (start === -1) return null

    const candidate = input.slice(start)

    let braces = 0
    let brackets = 0
    let inString = false
    let escaped = false

    for (let i = 0; i < candidate.length; i++) {
      const char = candidate[i]
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = !inString
        continue
      }
      if (inString) continue

      if (char === '{') braces++
      if (char === '}') braces--
      if (char === '[') brackets++
      if (char === ']') brackets--
    }

    let repaired = candidate

    if (inString) {
      repaired += '"'
      inString = false
    }

    while (brackets > 0) {
      repaired += ']'
      brackets--
    }
    while (braces > 0) {
      repaired += '}'
      braces--
    }

    const parsed = JSON.parse(repaired)
    if (parsed.patterns && Array.isArray(parsed.patterns)) {
      return repaired
    }
    return null
  } catch (e) {
    return null
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
