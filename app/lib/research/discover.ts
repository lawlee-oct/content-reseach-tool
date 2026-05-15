import type { ResearchPlatformKey } from "./types";
import type { TavilySearchHit } from "./tavily";

type UrlHit = { url: string };

const SOCIAL_HOST_SUBSTRINGS = [
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "youtube.com",
  "youtu.be",
  "threads.net",
  "twitter.com",
  "x.com",
  "reddit.com",
  "pinterest.com",
  "linkedin.com",
];

export function isSocialUrl(url: string): boolean {
  const u = url.toLowerCase();
  return SOCIAL_HOST_SUBSTRINGS.some((s) => u.includes(s));
}

export function registrableDomain(hostname: string): string {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  const parts = host.split(".").filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join(".");
  }
  return host;
}

export function humanNameFromDomain(domain: string): string {
  const root = domain.split(".")[0] ?? domain;
  if (!root) return domain;
  return root.slice(0, 1).toUpperCase() + root.slice(1);
}

export type CompetitorSeed = {
  competitor_id: string;
  name: string;
  root_domain: string;
  homepage: string;
  hits: TavilySearchHit[];
};

export function clusterHitsToCompetitors(
  hits: TavilySearchHit[],
  max: number,
): CompetitorSeed[] {
  const buckets = new Map<string, TavilySearchHit[]>();

  for (const hit of hits) {
    try {
      const url = new URL(hit.url);
      if (isSocialUrl(hit.url)) continue;
      const root = registrableDomain(url.hostname);
      if (!buckets.has(root)) buckets.set(root, []);
      buckets.get(root)!.push(hit);
    } catch {
      /* ignore bad urls */
    }
  }

  const ordered = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);

  const out: CompetitorSeed[] = [];
  for (const [root, group] of ordered) {
    if (out.length >= max) break;
    const homepage = `https://${root}`;
    const nameGuess =
      group[0]?.title?.split(/[|\-–]/)[0]?.trim() ||
      humanNameFromDomain(root.split(".")[0] ?? root);
    const slug = root.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    out.push({
      competitor_id: `cmp_${slug}`,
      name: nameGuess.slice(0, 80),
      root_domain: root,
      homepage,
      hits: group,
    });
  }

  return out;
}

export function pickFirstUrlForPlatform(
  hits: UrlHit[],
  platform: ResearchPlatformKey,
): string | null {
  const needle =
    platform === "website"
      ? null
      : platform === "instagram"
        ? "instagram.com"
        : platform === "tiktok"
          ? "tiktok.com"
          : platform === "facebook"
            ? "facebook.com"
            : platform === "youtube"
              ? "youtube.com"
              : platform === "threads"
                ? "threads.net"
                : null;

  if (!needle) return null;
  for (const h of hits) {
    if (h.url.toLowerCase().includes(needle)) return h.url;
  }
  return null;
}
