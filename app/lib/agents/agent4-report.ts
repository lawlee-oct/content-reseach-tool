// Agent 4 — Report Generator
// Input : PatternAnalysisResult + ResearchInput
// Output: FinalReport

import { PatternAnalysisResult, FinalReport, BlogTypeReport, HeadingStructure, ResearchInput } from '../../types'
import { callLLM } from '../agentUtils'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
// Only try the configured model; unsupported model names can cause 404s
const GEMINI_MODELS = Array.from(new Set([GEMINI_MODEL]))
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 16384
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 180000

// ─── Main Entry ──────────────────────────────────────────────────────────────

export async function runReportGeneratorAgent(
  patternResult: PatternAnalysisResult,
  input: ResearchInput,
  onProgress?: (msg: string) => void
): Promise<FinalReport> {
  const log = onProgress ?? console.log

  log(`Generating detailed report cho ${patternResult.patterns.length} blog types...`)

  const prompt = buildReportPrompt(patternResult, input)
  const raw = await callGemini(prompt)

  log('Parsing report...')
  const blogTypes = parseReportResponse(raw, patternResult)

  const report: FinalReport = {
    input,
    generatedAt: new Date().toISOString(),
    summary: buildSummary(patternResult, input),
    totalArticlesAnalyzed: patternResult.totalArticlesAnalyzed,
    topCompetitors: patternResult.topDomains.slice(0, 5).map(d => d.domain),
    blogTypes,
  }

  log(`Report hoàn tất: ${blogTypes.length} blog types`)
  return report
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildReportPrompt(result: PatternAnalysisResult, input: ResearchInput): string {
  const inputDesc = input.type === 'text'
    ? `Niche/Brand: "${input.value}"`
    : `Website: ${input.value}`

  const patternsData = result.patterns.slice(0, 20).map(p => ({
    id: p.id,
    name: p.name,
    titleTemplate: p.titleTemplate,
    frequency: p.frequency,
    frequencyPct: p.frequencyPct,
    seoScore: p.seoScore,
    avgWordCount: p.avgWordCount,
    dominantH2Pattern: p.dominantH2Pattern,
    exampleUrls: p.exampleUrls,
    exampleTitles: p.exampleTitles,
  }))

  return `You are a senior SEO content strategist. Generate a detailed, actionable blog content plan.

CONTEXT: ${inputDesc}
COMPETITOR ANALYSIS: ${result.totalArticlesAnalyzed} articles analyzed from ${result.topDomains.length} domains.

IDENTIFIED PATTERNS:
${JSON.stringify(patternsData, null, 0)}

TASK:
For EACH pattern, generate a complete blog type report with:
1. 3 ready-to-use title examples (specific, SEO-optimized)
2. Recommended word count range
3. H2 heading structure (5-7 H2s)
4. 3 actionable content tips specific to this pattern
5. Difficulty assessment
6. SEO notes

IMPORTANT: Respond ONLY with valid JSON, no markdown. Exact structure:
{
  "blogTypes": [
    {
      "patternId": "pattern-1",
      "patternName": "Best [Product] Under $[Price]",
      "titleTemplate": "Best {product} Under \${price} in {year}",
      "titleExamples": [
        "Best Wireless Earbuds Under $50 in 2025",
        "Best Coffee Makers Under $100: 10 Top Picks",
        "Best Laptops Under $500 for Students in 2025"
      ],
      "recommendedWordCount": "2000–3000 words",
      "headingStructure": {
        "h1": "Best [Product] Under $[Price] in [Year]: Top [N] Picks",
        "h2s": [
          "Quick Picks: Best [Product] at a Glance",
          "What to Look for in a [Product]",
          "1. [Product Name] – Best Overall",
          "2. [Product Name] – Best Budget Option",
          "How We Tested These [Products]",
          "Frequently Asked Questions"
        ],
        "notes": "Always include a comparison table after Quick Picks. FAQ section boosts featured snippet chances."
      },
      "seoNotes": "Target long-tail keywords with price modifier. Use schema markup for reviews. Update annually.",
      "contentTips": [
        "Include a sortable comparison table near the top for quick scanning",
        "Add 'Last Updated' date prominently — readers trust freshness",
        "Link to each product's Amazon/retailer page with affiliate disclosure"
      ],
      "exampleUrls": ["https://..."],
      "seoScore": 9,
      "difficulty": "medium"
    }
  ]
}`
}

// ─── Gemini API Call ──────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set in Agent 4')
    console.error('   Fix: Set GEMINI_API_KEY in .env.local')
    throw new Error('No Gemini API key configured. Set GEMINI_API_KEY in .env')
  }

  let lastError: Error | null = null
  let geminiTried = false

  for (const model of GEMINI_MODELS) {
    try {
      console.log(`📡 Agent 4 trying Gemini model: ${model}`)
      return await callGeminiModel(model, prompt)
    } catch (error) {
      geminiTried = true
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`⚠️ Agent 4 - Gemini model ${model} failed: ${lastError.message}`)
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      console.warn('↪️ Agent 4 - Falling back to OpenAI')
      return await callLLM(prompt, 4000)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`⚠️ Agent 4 - OpenAI fallback failed: ${lastError.message}`)
    }
  }

  const errorMsg = `Agent 4 failed: No working LLM provider. Tried Gemini. ${geminiTried ? 'Set OPENAI_API_KEY as fallback.' : 'Set GEMINI_API_KEY or OPENAI_API_KEY.'}`
  throw new Error(errorMsg)
}

async function callGeminiModel(model: string, prompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        // response should be JSON
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
  if (!text) throw new Error('Gemini returned empty response or unexpected response shape')
  return text
}

// ─── Response Parser ──────────────────────────────────────────────────────────

function parseReportResponse(
  raw: string,
  patternResult: PatternAnalysisResult
): BlogTypeReport[] {
  let parsed: any

  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    try {
      parsed = JSON.parse(cleaned)
    } catch (_e) {
      const extracted = extractJsonObject(cleaned)
      if (extracted) {
        parsed = JSON.parse(extracted)
      } else {
        // Try to repair truncated JSON
        const repaired = repairTruncatedJson(cleaned)
        if (repaired) {
          parsed = JSON.parse(repaired)
        } else {
          throw _e
        }
      }
    }
  } catch (e) {
    console.error('⚠️ Failed to parse Agent 4 response (using fallback):')
    console.error(`   Raw length: ${raw.length} chars`)
    console.error(`   First 200 chars: ${raw.slice(0, 200)}...`)
    console.error(`   Last 200 chars: ...${raw.slice(-200)}`)
    console.error(`   Error: ${(e as Error).message}`)
    return buildFallbackReport(patternResult)
  }

  const blogTypes: BlogTypeReport[] = (parsed.blogTypes ?? []).map((b: any) => {
    const matchedPattern = patternResult.patterns.find(p => p.id === b.patternId)

    const headingStructure: HeadingStructure = {
      h1: b.headingStructure?.h1 ?? b.titleTemplate ?? '',
      h2s: Array.isArray(b.headingStructure?.h2s) ? b.headingStructure.h2s : [],
      notes: b.headingStructure?.notes ?? '',
    }

    return {
      patternId: b.patternId ?? '',
      patternName: b.patternName ?? '',
      titleTemplate: b.titleTemplate ?? '',
      titleExamples: Array.isArray(b.titleExamples) ? b.titleExamples.slice(0, 3) : [],
      recommendedWordCount: b.recommendedWordCount ?? '1500–2500 words',
      headingStructure,
      seoNotes: b.seoNotes ?? '',
      contentTips: Array.isArray(b.contentTips) ? b.contentTips.slice(0, 4) : [],
      exampleUrls: matchedPattern?.exampleUrls ?? [],
      seoScore: Math.min(10, Math.max(1, Number(b.seoScore) || 7)),
      difficulty: validateDifficulty(b.difficulty),
    }
  })

  return blogTypes
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function buildFallbackReport(patternResult: PatternAnalysisResult): BlogTypeReport[] {
  return patternResult.patterns.slice(0, 15).map(p => ({
    patternId: p.id,
    patternName: p.name,
    titleTemplate: p.titleTemplate,
    titleExamples: p.exampleTitles,
    recommendedWordCount: `${Math.max(800, p.avgWordCount - 300)}–${p.avgWordCount + 300} words`,
    headingStructure: {
      h1: p.titleTemplate,
      h2s: p.dominantH2Pattern ? p.dominantH2Pattern.split(' → ') : [],
      notes: '',
    },
    seoNotes: `SEO Score: ${p.seoScore}/10. Pattern frequency: ${p.frequencyPct}% of analyzed articles.`,
    contentTips: [
      `This pattern appeared ${p.frequency} times in competitor content`,
      `Average word count: ~${p.avgWordCount} words`,
    ],
    exampleUrls: p.exampleUrls,
    seoScore: p.seoScore,
    difficulty: scoreToDifficulty(p.seoScore),
  }))
}

// ─── Summary Builder ──────────────────────────────────────────────────────────

function buildSummary(result: PatternAnalysisResult, input: ResearchInput): string {
  const inputDesc = input.type === 'text' ? `"${input.value}"` : input.value
  const topPattern = result.patterns[0]
  const topDomain = result.topDomains[0]?.domain ?? 'N/A'

  return `Analyzed ${result.totalArticlesAnalyzed} articles for ${inputDesc}. ` +
    `Found ${result.patterns.length} distinct blog patterns. ` +
    `Top pattern: "${topPattern?.name}" (${topPattern?.frequencyPct}% of articles, SEO score ${topPattern?.seoScore}/10). ` +
    `Dominant competitor: ${topDomain}. ` +
    (result.analysisNotes ? result.analysisNotes : '')
}

// ─── Utils ────────────────────────────────────────────────────────────────────

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

// Try to repair truncated JSON by finding last complete object
function repairTruncatedJson(input: string): string | null {
  try {
    const start = input.indexOf('{')
    if (start === -1) return null

    // Use full tail from first '{' since truncation may cut closing braces or strings
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

    // If we ended inside an open string, close it
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
    if (parsed.blogTypes && Array.isArray(parsed.blogTypes)) {
      return repaired
    }
    return null
  } catch {
    return null
  }
}

function validateDifficulty(val: any): 'easy' | 'medium' | 'hard' {
  if (val === 'easy' || val === 'medium' || val === 'hard') return val
  return 'medium'
}

function scoreToDifficulty(score: number): 'easy' | 'medium' | 'hard' {
  if (score >= 8) return 'hard'
  if (score >= 5) return 'medium'
  return 'easy'
}
