import type { ContentBadge } from "./types";

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "best",
  "home",
  "shop",
  "online",
  "store",
  "official",
  "site",
  "www",
  "http",
  "https",
]);

export function tokenizeNiche(niche: string): string[] {
  return niche
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export function inferFormatFromUrl(url: string, title: string): string {
  const u = url.toLowerCase();
  const t = title.toLowerCase();
  if (u.includes("/reel/") || t.includes("reel")) return "Reel";
  if (u.includes("tiktok.com")) return "Short video";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "Video";
  if (u.includes("threads.net")) return "Thread";
  if (u.includes("facebook.com")) return "Social post";
  if (u.includes("instagram.com")) return "Instagram content";
  if (u.includes("/blog/") || u.includes("/ideas") || u.includes("/articles/"))
    return "Article";
  if (t.includes("how to") || t.includes("how-to")) return "How-to";
  if (t.includes("best ") || t.includes(" top ")) return "Listicle";
  return "Page";
}

export function scoreContent(args: {
  nicheTokens: string[];
  title: string;
  snippet: string;
  platform: string;
}): { score: number; badge: ContentBadge; why: string } {
  const hay = `${args.title} ${args.snippet}`.toLowerCase();
  let hits = 0;
  for (const tok of args.nicheTokens) {
    if (tok && hay.includes(tok)) hits += 1;
  }
  const density =
    args.nicheTokens.length > 0 ? hits / args.nicheTokens.length : 0;

  let score = 55 + Math.round(density * 38);
  if (args.title.length > 24 && args.title.length < 120) score += 4;
  if (args.platform === "website") score += 3;
  if (args.platform === "tiktok" || args.platform === "instagram") score += 2;

  score = Math.min(99, Math.max(40, score));

  const badge: ContentBadge =
    score >= 85 ? "high" : score >= 72 ? "med" : "low";

  const why =
    density > 0.35
      ? "Strong keyword overlap with your niche plus readable title."
      : density > 0.15
        ? "Moderate relevance to niche; worth testing angles inspired by this format."
        : "Broad relevance; use as structural inspiration more than niche-specific copy.";

  return { score, badge, why };
}
