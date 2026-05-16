// Agent 2 — Content Crawler
// Input : string[] (blog URLs)
// Output: CrawledArticle[]
//
// Dùng Playwright để tải trang giống trình duyệt, sau đó fallback về fetch nếu cần.

import { chromium, type Browser } from 'playwright'
import { CrawledArticle, StructureHint } from '../../types'

const CONCURRENCY = 4
const THROTTLE_MS = 800
const TIMEOUT_MS = 12000
const PLAYWRIGHT_TIMEOUT_MS = 25000
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'

const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.google.com/',
}

// Title patterns để detect structure hint
const HINT_PATTERNS: { hint: StructureHint; patterns: RegExp[] }[] = [
  {
    hint: 'best-list',
    patterns: [/\bbest\b/i, /\btop \d+/i, /\bbest \d+/i],
  },
  {
    hint: 'how-to',
    patterns: [/\bhow to\b/i, /\bhow do\b/i, /\bstep[- ]by[- ]step\b/i],
  },
  {
    hint: 'review',
    patterns: [/\breview\b/i, /\breviews\b/i, /\brated\b/i, /\btest(ed)?\b/i],
  },
  {
    hint: 'comparison',
    patterns: [/\bvs\.?\b/i, /\bversus\b/i, /\bcompar(e|ison)\b/i, /\balternative/i],
  },
  {
    hint: 'guide',
    patterns: [/\bguide\b/i, /\bcomplete guide\b/i, /\bbeginner\b/i, /\bultimate\b/i],
  },
  {
    hint: 'roundup',
    patterns: [/\broundup\b/i, /\bround[- ]up\b/i, /\bbest of\b/i],
  },
  {
    hint: 'listicle',
    patterns: [/^\d+\s/i, /\b\d+ (ways|tips|tricks|reasons|things)\b/i],
  },
  {
    hint: 'faq',
    patterns: [/\bfaq\b/i, /\bfrequently asked\b/i, /\bquestions? (about|on)\b/i],
  },
  {
    hint: 'case-study',
    patterns: [/\bcase study\b/i, /\bcase studies\b/i, /\bsuccess stor(y|ies)\b/i],
  },
]

// ─── Main Entry ──────────────────────────────────────────────────────────────

export async function runCrawlerAgent(
  urls: string[],
  onProgress?: (msg: string, done: number, total: number) => void
): Promise<CrawledArticle[]> {
  const log = onProgress ?? ((msg: string) => console.log(msg))
  const results: CrawledArticle[] = []
  const failed: string[] = []

  let browser: Browser | null = null
  try {
    try {
      browser = await chromium.launch({ headless: true })
    } catch (error: unknown) {
      console.warn('Playwright launch failed, falling back to fetch-only crawl:', (error as Error).message)
      browser = null
    }

    // Chạy theo batch CONCURRENCY
    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY)

      const batchResults = await Promise.allSettled(
        batch.map(url => crawlSingleUrl(url, browser))
      )

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j]
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value)
        } else {
          failed.push(batch[j])
        }
      }

      log(
        `Crawled ${Math.min(i + CONCURRENCY, urls.length)}/${urls.length}`,
        Math.min(i + CONCURRENCY, urls.length),
        urls.length
      )

      // Throttle giữa các batch
      if (i + CONCURRENCY < urls.length) {
        await sleep(THROTTLE_MS)
      }
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }

  console.log(`Crawl complete: ${results.length} success, ${failed.length} failed`)
  return results
}

// ─── Single URL Crawler ───────────────────────────────────────────────────────

async function crawlSingleUrl(url: string, browser: Browser | null): Promise<CrawledArticle | null> {
  if (browser) {
    try {
      return await crawlWithPlaywright(url, browser)
    } catch (error: unknown) {
      console.warn(`Playwright crawl failed for ${url}: ${(error as Error).message}. Falling back to fetch.`)
    }
  }

  return await crawlViaFetch(url)
}

async function crawlWithPlaywright(url: string, browser: Browser): Promise<CrawledArticle> {
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  try {
    const response = await page.goto(url, {
      timeout: PLAYWRIGHT_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    })

    if (!response || !response.ok()) {
      throw new Error(`HTTP ${response?.status() ?? 'unknown'} ${response?.statusText() ?? ''}`)
    }

    const html = await page.content()
    return parseHtml(url, html)
  } finally {
    await page.close()
    await context.close()
  }
}

async function crawlViaFetch(url: string): Promise<CrawledArticle | null> {
  try {
    const res = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    })

    if (!res.ok) {
      console.warn(`Crawler: ${url} returned ${res.status} ${res.statusText}`)
      return null
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      console.warn(`Crawler: ${url} returned content-type ${contentType}`)
      return null
    }

    const html = await res.text()
    return parseHtml(url, html)
  } catch (error: unknown) {
    console.warn(`Crawler: ${url} failed: ${(error as Error).message}`)
    return null
  }
}

// ─── HTML Parser ─────────────────────────────────────────────────────────────

function parseHtml(url: string, html: string): CrawledArticle {
  const domain = extractDomain(url)

  // ── Title ──
  const title =
    extractTag(html, 'title') ||
    extractMeta(html, 'og:title') ||
    extractMeta(html, 'twitter:title') ||
    ''

  // ── H1 ──
  const h1 = extractFirstTag(html, 'h1') || ''

  // ── H2s ──
  const h2s = extractAllTags(html, 'h2').slice(0, 20)

  // ── H3s ──
  const h3s = extractAllTags(html, 'h3').slice(0, 30)

  // ── Meta description ──
  const metaDesc =
    extractMeta(html, 'description') ||
    extractMeta(html, 'og:description') ||
    ''

  // ── Canonical ──
  const canonical = extractCanonical(html) || url

  // ── Word count (estimate từ body text) ──
  const bodyText = stripHtml(extractBody(html))
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length

  // ── Internal link count ──
  const internalLinkCount = countInternalLinks(html, domain)

  // ── Structure hints ──
  const structureHints = detectStructureHints(title, h1, h2s)

  return {
    url,
    domain,
    title: cleanText(title),
    h1: cleanText(h1),
    h2s: h2s.map(cleanText),
    h3s: h3s.map(cleanText),
    metaDesc: cleanText(metaDesc),
    wordCount,
    canonical,
    internalLinkCount,
    structureHints,
    crawledAt: new Date().toISOString(),
  }
}

// ─── HTML Extraction Helpers ──────────────────────────────────────────────────

function extractTag(html: string, tag: string): string {
  const m = html.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, 'i'))
  return m ? m[1] : ''
}

function extractFirstTag(html: string, tag: string): string {
  const m = html.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is'))
  return m ? stripHtml(m[1]) : ''
}

function extractAllTags(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'gis')
  return [...html.matchAll(regex)].map(m => stripHtml(m[1]))
}

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) return m[1]
  }
  return ''
}

function extractCanonical(html: string): string {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)
  return m ? m[1] : ''
}

function extractBody(html: string): string {
  // Remove scripts, styles, nav, footer
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/[\r\n\t]/g, ' ').trim().slice(0, 500)
}

function countInternalLinks(html: string, domain: string): number {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1])
  return hrefs.filter(h => h.includes(domain) || h.startsWith('/')).length
}

// ─── Structure Hint Detector ──────────────────────────────────────────────────

function detectStructureHints(title: string, h1: string, h2s: string[]): StructureHint[] {
  const text = `${title} ${h1} ${h2s.join(' ')}`
  const hints: StructureHint[] = []

  for (const { hint, patterns } of HINT_PATTERNS) {
    if (patterns.some(p => p.test(text))) {
      hints.push(hint)
    }
  }

  return hints.length > 0 ? hints : ['other']
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── NOTE: Playwright Option ──────────────────────────────────────────────────
// Nếu cần crawl JS-rendered sites (React/Vue SPAs), thay crawlSingleUrl bằng:
//
// import { chromium } from 'playwright'
// const browser = await chromium.launch()
// const page = await browser.newPage()
// await page.goto(url, { timeout: 15000 })
// const html = await page.content()
// await browser.close()
//
// Nhớ install: npm install playwright
// Và chạy: npx playwright install chromium
//
// Với Vercel: không support Playwright — cần tách thành service riêng trên
// Railway hoặc Render, sau đó gọi qua internal API.
