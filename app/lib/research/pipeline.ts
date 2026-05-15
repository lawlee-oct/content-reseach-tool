import { randomUUID } from "node:crypto";
import type {
  AggregateRow,
  CompetitorResult,
  ContentFinding,
  ResearchPlatformKey,
  ResearchRequestBody,
  ResearchResponse,
  ResearchSummary,
} from "./types";
import { tavilyExtract, tavilySearch } from "./tavily";
import {
  clusterHitsToCompetitors,
  isSocialUrl,
  pickFirstUrlForPlatform,
  registrableDomain,
} from "./discover";
import { inferFormatFromUrl, scoreContent, tokenizeNiche } from "./scoring";
import { synthesizeBrandInsights } from "./llm-synthesis";

const MAX_COMPETITORS_CAP = 5;
const MAX_TAVILY_SEARCHES = 14;

type PipelineContext = {
  apiKey: string;
  nicheLabel: string;
  platforms: ResearchPlatformKey[];
  maxCompetitors: number;
  searchBudget: { used: number; limit: number };
  notes: string[];
};

async function guardedSearch(
  ctx: PipelineContext,
  query: string,
  maxResults?: number,
) {
  if (ctx.searchBudget.used >= ctx.searchBudget.limit) {
    ctx.notes.push(`Search budget reached; skipped query: ${query.slice(0, 80)}…`);
    return null;
  }
  ctx.searchBudget.used += 1;
  return tavilySearch(ctx.apiKey, query, { maxResults: maxResults ?? 8 });
}

function deriveNicheLabel(req: ResearchRequestBody): string {
  if (req.mode === "niche") return req.value.trim();
  if (req.mode === "brand")
    return `${req.value.trim()} and adjacent brands in the same category`;
  return `Market context inferred from product page: ${req.value.trim()}`;
}

async function resolveNicheFromUrl(
  ctx: PipelineContext,
  url: string,
): Promise<string> {
  const ex = await tavilyExtract(ctx.apiKey, [url]);
  const text = ex.results[0]?.raw_content ?? ex.results[0]?.content ?? "";
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 420);
  if (!snippet) {
    ctx.notes.push("URL extract returned empty text; using hostname as niche hint.");
    try {
      return `Products and content similar to ${new URL(url).hostname}`;
    } catch {
      return "Related ecommerce niche";
    }
  }
  return snippet;
}

function platformFromUrl(url: string): ResearchPlatformKey | null {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("facebook.com")) return "facebook";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("threads.net")) return "threads";
  if (!isSocialUrl(url)) return "website";
  return null;
}

function buildFindingsForCompetitor(args: {
  nicheTokens: string[];
  platforms: ResearchPlatformKey[];
  seedHits: { title: string; url: string; content: string }[];
  socialHits: Partial<
    Record<ResearchPlatformKey, { title: string; url: string; content: string }[]>
  >;
  extractSnippets: { url: string; snippet: string }[];
  rootDomain: string;
}): ContentFinding[] {
  const findings: ContentFinding[] = [];

  for (const hit of args.seedHits) {
    try {
      const host = new URL(hit.url).hostname;
      if (registrableDomain(host) !== args.rootDomain) continue;
    } catch {
      continue;
    }
    const platform: ResearchPlatformKey = "website";
    if (!args.platforms.includes(platform)) continue;
    const snippet = (hit.content || "").slice(0, 600);
    const scored = scoreContent({
      nicheTokens: args.nicheTokens,
      title: hit.title,
      snippet,
      platform,
    });
    findings.push({
      platform,
      url: hit.url,
      title: hit.title || args.rootDomain,
      format: inferFormatFromUrl(hit.url, hit.title),
      metrics: { source: "web_search" },
      score: scored.score,
      badge: scored.badge,
      why: scored.why,
    });
  }

  for (const [platKey, list] of Object.entries(args.socialHits) as [
    ResearchPlatformKey,
    { title: string; url: string; content: string }[],
  ][]) {
    if (!args.platforms.includes(platKey)) continue;
    for (const hit of list ?? []) {
      const p = platformFromUrl(hit.url);
      if (!p || p !== platKey) continue;
      const snippet = (hit.content || "").slice(0, 600);
      const scored = scoreContent({
        nicheTokens: args.nicheTokens,
        title: hit.title,
        snippet,
        platform: platKey,
      });
      findings.push({
        platform: platKey,
        url: hit.url,
        title: hit.title || hit.url,
        format: inferFormatFromUrl(hit.url, hit.title),
        metrics: { source: "social_search" },
        score: scored.score,
        badge: scored.badge,
        why: scored.why,
      });
    }
  }

  for (const row of args.extractSnippets) {
    if (!args.platforms.includes("website")) continue;
    try {
      if (registrableDomain(new URL(row.url).hostname) !== args.rootDomain) continue;
    } catch {
      continue;
    }
    const title = `On-page signals: ${row.url}`;
    const scored = scoreContent({
      nicheTokens: args.nicheTokens,
      title,
      snippet: row.snippet,
      platform: "website",
    });
    findings.push({
      platform: "website",
      url: row.url,
      title,
      format: "Extracted page",
      metrics: { source: "tavily_extract" },
      score: Math.min(98, scored.score + 1),
      badge: scored.badge,
      why: `${scored.why} (includes longer on-page text.)`,
    });
  }

  const deduped = new Map<string, ContentFinding>();
  for (const f of findings) {
    deduped.set(f.url, f);
  }
  return [...deduped.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function buildAggregate(
  competitors: CompetitorResult[],
  limit: number,
): AggregateRow[] {
  const rows: AggregateRow[] = [];
  for (const c of competitors) {
    for (const item of c.top_content) {
      rows.push({
        rank: 0,
        competitor_id: c.competitor_id,
        competitor_name: c.name,
        platform: item.platform,
        url: item.url,
        title: item.title,
        score: item.score,
        badge: item.badge,
      });
    }
  }
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}

async function discoverSocialHits(
  ctx: PipelineContext,
  brandName: string,
): Promise<
  Partial<
    Record<ResearchPlatformKey, { title: string; url: string; content: string }[]>
  >
> {
  const out: Partial<
    Record<ResearchPlatformKey, { title: string; url: string; content: string }[]>
  > = {};

  const tasks: Array<Promise<void>> = [];

  const run = (platform: ResearchPlatformKey, query: string) => {
    tasks.push(
      (async () => {
        const res = await guardedSearch(ctx, query, 6);
        if (!res) return;
        out[platform] = res.results.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        }));
      })(),
    );
  };

  if (ctx.platforms.includes("instagram"))
    run("instagram", `${brandName} official instagram profile`);
  if (ctx.platforms.includes("tiktok"))
    run("tiktok", `${brandName} official tiktok profile`);
  if (ctx.platforms.includes("youtube"))
    run("youtube", `${brandName} official youtube channel`);
  if (ctx.platforms.includes("facebook"))
    run("facebook", `${brandName} official facebook page`);
  if (ctx.platforms.includes("threads"))
    run("threads", `${brandName} official threads profile`);

  await Promise.all(tasks);
  return out;
}

async function runLivePipeline(
  req: ResearchRequestBody,
  nicheLabel: string,
): Promise<ResearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY!;
  const jobId = `job_${randomUUID()}`;
  const platforms = [...new Set(req.platforms)];
  const maxCompetitors = Math.min(
    MAX_COMPETITORS_CAP,
    Math.max(1, req.max_competitors ?? 4),
  );

  const notes: string[] = [
    "Live run uses Tavily search + extract. Social profiles come from search discovery; production systems should prefer official APIs where available.",
  ];

  const ctx: PipelineContext = {
    apiKey,
    nicheLabel,
    platforms,
    maxCompetitors,
    searchBudget: { used: 0, limit: MAX_TAVILY_SEARCHES },
    notes,
  };

  let primaryQuery = "";
  if (req.mode === "niche") {
    primaryQuery = `${req.value.trim()} best online brands retailers official website`;
  } else if (req.mode === "brand") {
    primaryQuery = `${req.value.trim()} competitors similar brands official online store`;
  } else {
    const inferred = await resolveNicheFromUrl(ctx, req.value.trim());
    primaryQuery = `${inferred.slice(0, 240)} leading brands stores official site`;
    notes.push("URL mode used on-page text to infer a discovery query.");
  }

  const main = await guardedSearch(ctx, primaryQuery, 10);
  if (!main || main.results.length === 0) {
    throw new Error("No search results returned for the primary query.");
  }

  const seeds = clusterHitsToCompetitors(main.results, maxCompetitors);
  if (seeds.length === 0) {
    throw new Error("Could not cluster competitors from search results.");
  }

  const nicheTokens = tokenizeNiche(
    req.mode === "niche" ? req.value : nicheLabel,
  );

  const extractUrls: string[] = [];
  for (const s of seeds) {
    extractUrls.push(s.homepage);
    for (const h of s.hits.slice(0, 2)) {
      if (!extractUrls.includes(h.url)) extractUrls.push(h.url);
    }
  }

  const extracted = await tavilyExtract(ctx.apiKey, extractUrls);
  const snippets = (extracted.results ?? []).map((r) => ({
    url: r.url,
    snippet: (r.raw_content ?? r.content ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 900),
  }));

  const competitors: CompetitorResult[] = [];

  for (const seed of seeds) {
    const socialHits = await discoverSocialHits(ctx, seed.name);

    const profiles: CompetitorResult["profiles"] = {};
    if (platforms.includes("website")) {
      profiles.website = seed.homepage;
    }
    if (platforms.includes("instagram")) {
      profiles.instagram =
        pickFirstUrlForPlatform(socialHits.instagram ?? [], "instagram") ??
        pickFirstUrlForPlatform(main.results, "instagram");
    }
    if (platforms.includes("tiktok")) {
      profiles.tiktok =
        pickFirstUrlForPlatform(socialHits.tiktok ?? [], "tiktok") ??
        pickFirstUrlForPlatform(main.results, "tiktok");
    }
    if (platforms.includes("youtube")) {
      profiles.youtube =
        pickFirstUrlForPlatform(socialHits.youtube ?? [], "youtube") ??
        pickFirstUrlForPlatform(main.results, "youtube");
    }
    if (platforms.includes("facebook")) {
      profiles.facebook =
        pickFirstUrlForPlatform(socialHits.facebook ?? [], "facebook") ??
        pickFirstUrlForPlatform(main.results, "facebook");
    }
    if (platforms.includes("threads")) {
      profiles.threads =
        pickFirstUrlForPlatform(socialHits.threads ?? [], "threads") ??
        pickFirstUrlForPlatform(main.results, "threads");
    }

    const extractForSeed = snippets.filter((row) => {
      try {
        return registrableDomain(new URL(row.url).hostname) === seed.root_domain;
      } catch {
        return false;
      }
    });

    const top_content = buildFindingsForCompetitor({
      nicheTokens,
      platforms,
      seedHits: seed.hits,
      socialHits,
      extractSnippets: extractForSeed,
      rootDomain: seed.root_domain,
    });

    competitors.push({
      competitor_id: seed.competitor_id,
      name: seed.name,
      confidence: 0.75,
      discovery_sources: [`tavily_search:${primaryQuery.slice(0, 120)}`],
      profiles,
      top_content,
    });
  }

  const { brands, method } = await synthesizeBrandInsights({
    niche: nicheLabel,
    locale: req.locale ?? "en-US",
    competitors,
  });

  const topicInsightsCount = brands.reduce(
    (n, b) =>
      n +
      b.socials.reduce((m, soc) => m + soc.hot_content.length, 0),
    0,
  );

  notes.push(
    method === "llm"
      ? "Báo cáo brand → social → hot content: OpenAI tổng hợp trên evidence Tavily (URL trong evidence phải khớp nguồn)."
      : "Báo cáo brand → social → hot content: nhóm heuristic. Thêm OPENAI_API_KEY để LLM gộp + chấm điểm (vẫn neo URL Tavily).",
  );

  const platforms_covered = [...new Set(platforms)] as ResearchPlatformKey[];
  const content_items_analyzed = competitors.reduce(
    (n, c) => n + c.top_content.length,
    0,
  );

  const summary: ResearchSummary = {
    competitors_found: competitors.length,
    platforms_covered,
    content_items_analyzed,
    topic_insights_count: topicInsightsCount,
    synthesis_method: method,
    notes,
  };

  return {
    research_job_id: jobId,
    input: {
      niche: nicheLabel,
      locale: req.locale ?? "en-US",
      mode: req.mode,
      raw_value: req.value.trim(),
    },
    summary,
    competitors,
    aggregate_top_content_for_niche: buildAggregate(competitors, 15),
    brands,
  };
}

export async function runResearch(
  req: ResearchRequestBody,
): Promise<ResearchResponse> {
  if (!process.env.TAVILY_API_KEY?.trim()) {
    throw new Error(
      "Thiếu TAVILY_API_KEY. Thêm biến vào .env.local — xem README.md.",
    );
  }

  const nicheLabel = deriveNicheLabel(req);
  const platforms =
    req.platforms.length > 0
      ? ([...new Set(req.platforms)] as ResearchPlatformKey[])
      : (["website", "instagram", "tiktok", "facebook"] as ResearchPlatformKey[]);

  const normalizedReq: ResearchRequestBody = { ...req, platforms };

  return runLivePipeline(normalizedReq, nicheLabel);
}
