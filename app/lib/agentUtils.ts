import { chromium } from "playwright";
import { XMLParser } from "fast-xml-parser";

export type SerpApiResult = {
  position: number;
  title: string;
  link: string;
  domain: string;
};

export type CompetitorDiscoveryOutput = {
  domain: string | null;
  seedKeywords: string[];
  serpResults: Record<string, SerpApiResult[]>;
  blogUrls: string[];
};

export type CrawlResult = {
  url: string;
  title: string | null;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  wordCount: number;
  metaDescription: string | null;
  canonical: string | null;
  internalLinkCount: number;
  structureHints: string[];
  error?: string;
};

export type PatternCluster = {
  patternName: string;
  description: string;
  frequency: number;
  seoScore: number;
  examples: Array<{ url: string; title: string }>;
  patternTemplate?: string;
  seoNotes?: string;
};

export type ReportItem = {
  patternName: string;
  titleTemplate: string;
  recommendedWordCount: string;
  headingStructureExample: string[];
  exampleUrls: string[];
  seoNotes: string;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "about",
  "are",
  "via",
  "how",
  "to",
  "in",
  "on",
  "of",
  "a",
  "an",
  "is",
  "by",
  "at",
  "as",
  "or",
  "be",
  "it",
  "its",
  "why",
  "what",
  "when",
  "where",
  "which",
  "their",
  "we",
  "you",
  "can",
  "do",
  "best",
  "new",
  "latest",
]);

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const HINT_KEYWORDS = ["best", "review", "how to", "how-to", "vs", "guide"];

export function detectStructureHints(title: string | null) {
  if (!title) return [];
  const lower = title.toLowerCase();
  return HINT_KEYWORDS.filter((hint) => lower.includes(hint));
}

export function extractDomain(input: string): string {
  try {
    const url = new URL(input.trim());
    return url.hostname.replace(/^www\./, "");
  } catch (error) {
    const trimmed = input.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return trimmed.replace(/^www\./, "");
  }
}

export function normalizeUrl(input: string): string {
  try {
    const url = new URL(input.trim());
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return input.trim();
  }
}

export function extractKeywordsFromText(value: string, maxKeywords = 5): string[] {
  const cleaned = value
    .replace(/["\“\”\‘\’\(\)\[\]\{\}:;!\?\/\\]/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .toLowerCase();
  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && !STOP_WORDS.has(token) && token.length > 2);

  const frequencies = new Map<string, number>();
  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  const candidates = Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, maxKeywords * 2);

  const phrases: string[] = [];
  for (let i = 0; i + 1 < tokens.length && phrases.length < maxKeywords; i += 1) {
    const phrase = `${tokens[i]} ${tokens[i + 1]}`;
    if (!STOP_WORDS.has(tokens[i]) && !STOP_WORDS.has(tokens[i + 1]) && phrase.length > 4) {
      phrases.push(phrase);
    }
  }

  const uniques = new Set<string>();
  for (const phrase of phrases) {
    uniques.add(phrase);
  }
  for (const candidate of candidates) {
    if (uniques.size >= maxKeywords) break;
    uniques.add(candidate);
  }

  return Array.from(uniques).slice(0, maxKeywords);
}

export function parseSeedKeywords(value: string, maxKeywords = 5): string[] {
  const normalized = value
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .trim();

  const parts = normalized
    .split(/[,;|\/]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const uniqueParts = Array.from(new Set(parts));
  if (uniqueParts.length >= maxKeywords) {
    return uniqueParts.slice(0, maxKeywords);
  }

  const extracted = extractKeywordsFromText(value, maxKeywords);
  for (const keyword of extracted) {
    if (uniqueParts.length >= maxKeywords) break;
    if (!uniqueParts.includes(keyword)) {
      uniqueParts.push(keyword);
    }
  }

  return uniqueParts.slice(0, maxKeywords);
}

export async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

export async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} ${response.statusText} for ${url}`);
  }
  return response.text();
}

export function parseSitemapXml(xml: string): string[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const parsed = parser.parse(xml);
  const urls: string[] = [];

  if (parsed.urlset && parsed.urlset.url) {
    const urlNodes = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
    for (const entry of urlNodes) {
      if (entry.loc) {
        urls.push(String(entry.loc));
      }
    }
  }

  if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
    const mapNodes = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];
    for (const entry of mapNodes) {
      if (entry.loc) {
        urls.push(String(entry.loc));
      }
    }
  }

  return urls.map(normalizeUrl);
}

export function parseBlogHtmlForUrls(html: string, base: string, maxUrls = 100): string[] {
  const anchorRegex = /<a[^>]+href\s*=\s*['\"]([^'\"]+)['\"]/gi;
  const urls = new Set<string>();
  let match: RegExpExecArray | null;
  const baseUrl = new URL(base);

  while ((match = anchorRegex.exec(html))) {
    try {
      const raw = match[1].trim();
      if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) {
        continue;
      }
      const resolved = new URL(raw, baseUrl).toString();
      const normalized = normalizeUrl(resolved);
      const urlObj = new URL(normalized);
      if (urlObj.hostname !== baseUrl.hostname) continue;
      if (normalized.includes("#")) continue;
      if (normalized.endsWith(".xml")) continue;
      if (/\/(blog|news|posts|article|articles|guide|reviews?)\b/i.test(urlObj.pathname) || /\d{4}\/\d{2}/.test(urlObj.pathname)) {
        urls.add(normalized);
      }
      if (urls.size >= maxUrls) break;
    } catch {
      continue;
    }
  }

  return Array.from(urls).slice(0, maxUrls);
}

export async function discoverBlogUrls(domain: string, maxUrls = 100): Promise<string[]> {
  const root = `https://${domain}`;
  const candidates = [
    `${root}/sitemap.xml`,
    `${root}/sitemap_index.xml`,
    `${root}/blog/sitemap.xml`,
    `${root}/blog`,
    `${root}/blog/`,
    `${root}/news`,
    `${root}/articles`,
    `${root}`,
  ];
  const discovered = new Set<string>();

  for (const candidate of candidates) {
    try {
      const text = await fetchText(candidate, { headers: { Accept: "application/xml, text/html" }, redirect: "follow" });
      if (text.trim().startsWith("<?xml") || /<urlset|<sitemapindex/i.test(text)) {
        const urls = parseSitemapXml(text);
        for (const url of urls) {
          if (discovered.size >= maxUrls) break;
          if (url.includes(domain)) discovered.add(url);
        }
      } else {
        const urls = parseBlogHtmlForUrls(text, candidate, maxUrls);
        for (const url of urls) {
          if (discovered.size >= maxUrls) break;
          discovered.add(url);
        }
      }
    } catch (error) {
      continue;
    }
    if (discovered.size >= maxUrls) break;
  }

  return Array.from(discovered).slice(0, maxUrls);
}

export async function crawlUrls(urls: string[], concurrency = 3, throttleMs = 1200) {
  const browser = await chromium.launch({ headless: true });
  const queue = [...urls];
  const results = [] as CrawlResult[];

  async function worker() {
    const context = await browser.newContext();
    const page = await context.newPage();

    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;

      try {
        const response = await page.goto(url, { timeout: 30000, waitUntil: "domcontentloaded" });
        if (!response || !response.ok()) {
          throw new Error(`Navigation failed with status ${response?.status() || "unknown"}`);
        }

        const data = await page.evaluate(() => {
          const title = document.querySelector("title")?.innerText?.trim() ?? null;
          const headings = {
            h1: Array.from(document.querySelectorAll("h1")).map((node) => node.textContent?.trim() ?? "").filter(Boolean),
            h2: Array.from(document.querySelectorAll("h2")).map((node) => node.textContent?.trim() ?? "").filter(Boolean),
            h3: Array.from(document.querySelectorAll("h3")).map((node) => node.textContent?.trim() ?? "").filter(Boolean),
          };
          const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null;
          const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
          const visibleText = Array.from(document.querySelectorAll("body *"))
            .filter((node) => node instanceof HTMLElement && node.offsetParent !== null)
            .map((node) => node.textContent || "")
            .join(" ");
          const wordCount = visibleText.trim().split(/\s+/).filter(Boolean).length;
          const internalLinkCount = Array.from(document.querySelectorAll("a[href]")).filter((node) => {
            const href = node.getAttribute("href")?.trim();
            if (!href) return false;
            if (href.startsWith("http") || href.startsWith("//")) {
              try {
                const link = new URL(href, location.href);
                return link.hostname === location.hostname;
              } catch {
                return false;
              }
            }
            return true;
          }).length;

          return { title, headings, metaDescription, canonical, wordCount, internalLinkCount };
        });

        results.push({
          url,
          title: data.title,
          headings: data.headings,
          wordCount: data.wordCount,
          metaDescription: data.metaDescription,
          canonical: data.canonical,
          internalLinkCount: data.internalLinkCount,
          structureHints: detectStructureHints(data.title),
        });
      } catch (error: unknown) {
        results.push({
          url,
          title: null,
          headings: { h1: [], h2: [], h3: [] },
          wordCount: 0,
          metaDescription: null,
          canonical: null,
          internalLinkCount: 0,
          structureHints: [],
          error: (error as Error).message || "Unknown crawl failure",
        });
      }

      await sleep(throttleMs);
    }

    await page.close();
    await context.close();
  }

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));
  } finally {
    await browser.close();
  }

  return results;
}

export async function searchOrganicResults(keyword: string, serpApiKey: string): Promise<SerpApiResult[]> {
  const params = new URLSearchParams({
    q: keyword,
    engine: "google",
    num: "20",
    google_domain: "google.com",
    hl: "en",
    gl: "us",
    api_key: serpApiKey,
  });

  const url = `https://serpapi.com/search.json?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SerpAPI request failed ${response.status} ${response.statusText}`);
  }
  const body = await response.json();
  const organic = Array.isArray(body.organic_results) ? body.organic_results : [];

  return organic.slice(0, 20).map((item: any, index: number) => ({
    position: index + 1,
    title: item.title || item.snippet || "",
    link: item.link || item.url || "",
    domain: item.displayed_link || (item.link ? extractDomain(item.link) : ""),
  }));
}

function extractJSONSafe(text: string) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

export async function callLLM(prompt: string, maxTokens = 1200): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const geminiModel = process.env.GEMINI_MODEL?.trim() ?? "gemini-2.5-flash"
  const model = process.env.OPENAI_MODEL?.trim() ?? "gpt-4o-mini"
  const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || maxTokens
  const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 180000

  if (geminiKey) {
    console.log('📡 Using Gemini API')
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    })

    if (!geminiRes.ok) {
      const errorBody = await geminiRes.text()
      console.error(`❌ Gemini request failed ${geminiRes.status}`)
      throw new Error(`Gemini request failed ${geminiRes.status}: ${errorBody}`)
    }

    const geminiJson = await geminiRes.json()
    return geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  }

  if (openaiKey) {
    console.log('📡 Using OpenAI API')
    const body = {
      model,
      messages: [
        { role: "system", content: "You are a content research assistant that returns valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`❌ OpenAI request failed ${response.status}`)
      throw new Error(`OpenAI request failed ${response.status}: ${errorBody}`)
    }

    const json = await response.json()
    return json.choices?.[0]?.message?.content ?? ""
  }

  console.error('❌ No LLM API key available')
  console.error('   ➜ Set GEMINI_API_KEY for Google Gemini (free option)')
  console.error('   ➜ OR set OPENAI_API_KEY for OpenAI GPT-4')
  throw new Error("No Gemini or OpenAI API key available. Set GEMINI_API_KEY or OPENAI_API_KEY in your environment.")
}

export function parseJsonResult<T>(text: string): T {
  try {
    return JSON.parse(text);
  } catch (error) {
    const maybe = extractJSONSafe(text);
    return JSON.parse(maybe);
  }
}
