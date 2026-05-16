// Agent 1 — Competitor Discovery
// Input : ResearchInput (text hoặc url)
// Output: CompetitorResult { domains, blogUrls, seedKeywords }

import { ResearchInput, CompetitorResult } from '../../types'

const SERPAPI_KEY = process.env.SERPAPI_KEY!
const SERPAPI_BASE = 'https://serpapi.com/search.json'

// Pattern nhận diện URL blog (loại bỏ trang chủ, category, tag, v.v.)
const BLOG_URL_PATTERNS = [
  /\/blog\//i,
  /\/article/i,
  /\/post/i,
  /\/guide/i,
  /\/review/i,
  /\/best-/i,
  /\/how-to/i,
  /\/top-/i,
  /\/vs-/i,
  /\/comparison/i,
]

const EXCLUDE_DOMAINS = [
  'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
  'reddit.com', 'pinterest.com', 'amazon.com', 'wikipedia.org',
  'linkedin.com', 'tiktok.com',
]

// ─── Main Entry ──────────────────────────────────────────────────────────────

export async function runDiscoveryAgent(
  input: ResearchInput,
  onProgress?: (msg: string) => void
): Promise<CompetitorResult> {
  const log = onProgress ?? console.log

  if (input.type === 'text') {
    return discoverFromText(input, log)
  } else {
    return discoverFromUrl(input, log)
  }
}

// ─── Path A: từ text query ───────────────────────────────────────────────────

async function discoverFromText(
  input: ResearchInput,
  log: (msg: string) => void
): Promise<CompetitorResult> {
  const query = input.value
  log(`Generating seed keywords cho: "${query}"`)
  const maxUrls = (input as any).maxUrls ?? 100

  const seedKeywords = generateSeedKeywords(query)
  log(`Seed keywords: ${seedKeywords.join(', ')}`)

  const allResults: { url: string; domain: string }[] = []

  for (const kw of seedKeywords.slice(0, 3)) {
    log(`Searching SerpAPI: "${kw}"`)
    const results = await serpSearch(kw)
    allResults.push(...results)
    await sleep(500)
  }

  const domains = dedupe(
    allResults
      .map(r => r.domain)
      .filter(d => !EXCLUDE_DOMAINS.some(ex => d.includes(ex)))
  ).slice(0, 10)

  log(`Tìm thấy ${domains.length} competitor domains`)

  // Crawl blog URLs từ top domains
  const blogUrls: string[] = []
  for (const domain of domains.slice(0, 5)) {
    log(`Lấy blog URLs từ: ${domain}`)
    const urls = await fetchBlogUrlsFromDomain(domain)
    blogUrls.push(...urls)
    await sleep(300)
  }

  const finalUrls = dedupe(blogUrls).slice(0, maxUrls)
  log(`Tổng cộng ${finalUrls.length} blog URLs`)

  return { domains, blogUrls: finalUrls, seedKeywords }
}

// ─── Path B: từ URL ──────────────────────────────────────────────────────────

async function discoverFromUrl(
  input: ResearchInput,
  log: (msg: string) => void
): Promise<CompetitorResult> {
  const url = input.value
  const maxUrls = (input as any).maxUrls ?? 100
  const domain = extractDomain(url)
  log(`Phân tích domain: ${domain}`)

  // Lấy blog URLs từ domain chính
  const ownUrls = await fetchBlogUrlsFromDomain(domain)
  log(`${domain}: ${ownUrls.length} blog URLs`)

  // Tìm competitor qua SerpAPI bằng brand/niche từ URL
  const niche = domain.replace(/www\.|\.com|\.net|\.org/g, '')
  const seedKeywords = generateSeedKeywords(niche)
  const serpResults: { url: string; domain: string }[] = []

  for (const kw of seedKeywords.slice(0, 2)) {
    log(`Tìm competitor cho niche: "${kw}"`)
    const results = await serpSearch(kw)
    serpResults.push(...results.filter(r => r.domain !== domain))
    await sleep(500)
  }

  const competitorDomains = dedupe(
    serpResults
      .map(r => r.domain)
      .filter(d => !EXCLUDE_DOMAINS.some(ex => d.includes(ex)))
  ).slice(0, 8)

  const competitorUrls: string[] = []
  for (const d of competitorDomains.slice(0, 4)) {
    log(`Lấy blog URLs từ competitor: ${d}`)
    const urls = await fetchBlogUrlsFromDomain(d)
    competitorUrls.push(...urls)
    await sleep(300)
  }

  const allDomains = [domain, ...competitorDomains]
  const allUrls = dedupe([...ownUrls, ...competitorUrls]).slice(0, maxUrls)

  log(`Tổng cộng ${allUrls.length} blog URLs từ ${allDomains.length} domains`)

  return {
    domains: allDomains,
    blogUrls: allUrls,
    seedKeywords,
  }
}

// ─── SerpAPI ─────────────────────────────────────────────────────────────────

async function serpSearch(keyword: string): Promise<{ url: string; domain: string }[]> {
  const params = new URLSearchParams({
    api_key: SERPAPI_KEY,
    engine: 'google',
    q: keyword,
    num: '20',
    gl: 'us',
    hl: 'en',
  })

  const res = await fetch(`${SERPAPI_BASE}?${params}`)
  if (!res.ok) {
    console.error(`SerpAPI error: ${res.status}`)
    return []
  }

  const data = await res.json()
  const organicResults = data.organic_results ?? []

  return organicResults
    .filter((r: any) => r.link)
    .map((r: any) => ({
      url: r.link as string,
      domain: extractDomain(r.link),
    }))
}

// ─── Blog URL Fetcher ─────────────────────────────────────────────────────────

async function fetchBlogUrlsFromDomain(domain: string): Promise<string[]> {
  const urls: string[] = []

  // 1. Thử sitemap.xml
  const sitemapUrls = await tryFetchSitemap(domain)
  if (sitemapUrls.length > 0) {
    urls.push(...sitemapUrls)
  }

  // 2. Nếu sitemap không có, thử /blog page
  if (urls.length < 5) {
    const blogPageUrls = await tryFetchBlogPage(domain)
    urls.push(...blogPageUrls)
  }

  // Filter chỉ lấy URL có dấu hiệu blog
  return dedupe(urls)
    .filter(url => isBlogUrl(url))
    .slice(0, 30)
}

async function tryFetchSitemap(domain: string): Promise<string[]> {
  const sitemapPaths = [
    `https://${domain}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`,
    `https://${domain}/blog-sitemap.xml`,
    `https://www.${domain}/sitemap.xml`,
  ]

  for (const sitemapUrl of sitemapPaths) {
    try {
      const res = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogResearcher/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue

      const text = await res.text()

      // Nếu là sitemap index, lấy sub-sitemaps
      if (text.includes('<sitemapindex')) {
        const subUrls = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)]
          .map(m => m[1])
          .filter(u => u.includes('blog') || u.includes('post') || u.includes('article'))
          .slice(0, 3)

        const subResults: string[] = []
        for (const sub of subUrls) {
          const subRes = await fetch(sub, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogResearcher/1.0)' },
            signal: AbortSignal.timeout(8000),
          }).catch(() => null)
          if (!subRes?.ok) continue
          const subText = await subRes.text()
          const subLocs = [...subText.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
          subResults.push(...subLocs)
        }
        if (subResults.length > 0) return subResults
      }

      // Sitemap thường
      const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
      if (locs.length > 0) return locs
    } catch {
      continue
    }
  }
  return []
}

async function tryFetchBlogPage(domain: string): Promise<string[]> {
  const blogPaths = [
    `https://${domain}/blog`,
    `https://${domain}/articles`,
    `https://${domain}/posts`,
    `https://www.${domain}/blog`,
  ]

  for (const blogUrl of blogPaths) {
    try {
      const res = await fetch(blogUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogResearcher/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue

      const html = await res.text()

      // Extract all href links
      const hrefs = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1])
      const relativeHrefs = [...html.matchAll(/href="(\/[^"]+)"/g)].map(
        m => `https://${domain}${m[1]}`
      )

      return [...hrefs, ...relativeHrefs].filter(u => u.includes(domain))
    } catch {
      continue
    }
  }
  return []
}

// ─── Seed Keyword Generator ───────────────────────────────────────────────────

function generateSeedKeywords(query: string): string[] {
  const base = query.toLowerCase().trim()
  return [
    `best ${base} blog`,
    `${base} review site`,
    `${base} buying guide`,
    `top ${base} recommendations`,
    `${base} affiliate blog`,
  ]
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function isBlogUrl(url: string): boolean {
  return BLOG_URL_PATTERNS.some(p => p.test(url))
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
