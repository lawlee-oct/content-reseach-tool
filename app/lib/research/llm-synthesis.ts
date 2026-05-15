import type {
  BrandInsight,
  CompetitorResult,
  ContentFinding,
  HotContentEvidence,
  HotContentInsight,
  MetricSignal,
  MetricSignalSource,
  ResearchPlatformKey,
  SocialInsight,
} from "./types";

function slugKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function domainFromProfiles(c: CompetitorResult): string {
  const w = c.profiles.website;
  if (w) {
    try {
      return new URL(w).hostname.replace(/^www\./, "");
    } catch {
      /* fall through */
    }
  }
  const web = c.top_content.find((f) => f.platform === "website");
  if (web) {
    try {
      return new URL(web.url).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
  }
  return c.competitor_id.replace(/^cmp_/, "");
}

function metricSignalFromFinding(f: ContentFinding): MetricSignal {
  const m = f.metrics ?? {};
  const joined = Object.entries(m)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
  if (/\d/.test(joined) || /k\/mo|views|likes|k\s/i.test(joined)) {
    return {
      label: "Tín hiệu từ SERP/snippet",
      value_text: joined || undefined,
      source: "from_snippet",
    };
  }
  return {
    label: "Heuristic (không có API metric)",
    value_text: `Score thô ${f.score} · ${f.badge}`,
    source: "inferred",
  };
}

function findingToHotContent(f: ContentFinding): HotContentInsight {
  return {
    id: slugKey(`${f.platform}-${f.title || f.url}`).slice(0, 64),
    title: f.title,
    summary: f.why,
    formats: [f.format],
    score: f.score,
    score_breakdown: {
      relevance: Math.min(1, f.score / 100),
    },
    evidence: [
      {
        url: f.url,
        title: f.title,
        kind: f.format,
      },
    ],
    metric_signal: metricSignalFromFinding(f),
  };
}

/** Nhóm raw findings theo platform → `socials[].hot_content[]`. */
export function buildHeuristicBrandInsights(
  competitors: CompetitorResult[],
): BrandInsight[] {
  const platformOrder: ResearchPlatformKey[] = [
    "website",
    "facebook",
    "instagram",
    "tiktok",
    "youtube",
    "threads",
  ];

  return competitors.map((c) => {
    const socials: SocialInsight[] = [];

    for (const channel of platformOrder) {
      const profileOrRoot =
        c.profiles[channel] === undefined
          ? null
          : (c.profiles[channel] ?? null);
      const items = c.top_content.filter((f) => f.platform === channel);
      if (!items.length && !profileOrRoot) continue;

      const hot_content = items.slice(0, 8).map(findingToHotContent);

      socials.push({
        channel,
        profile_or_root_url: profileOrRoot,
        hot_content,
      });
    }

    return {
      brand_id: c.competitor_id,
      name: c.name,
      primary_domain: domainFromProfiles(c),
      brand_confidence: Math.min(0.95, c.confidence),
      socials,
      discovery_sources: c.discovery_sources,
    };
  });
}

const ALLOWED_SOURCES: MetricSignalSource[] = [
  "measured",
  "from_snippet",
  "inferred",
  "none",
];

function normalizeMetricSource(s: unknown): MetricSignalSource {
  if (typeof s === "string" && ALLOWED_SOURCES.includes(s as MetricSignalSource)) {
    return s as MetricSignalSource;
  }
  return "inferred";
}

function allowedUrlsForBrand(c: CompetitorResult): Set<string> {
  const s = new Set<string>();
  const add = (url: string) => {
    if (!url?.trim()) return;
    const t = url.trim();
    s.add(t);
    try {
      s.add(new URL(t).href);
    } catch {
      /* ignore */
    }
  };
  for (const f of c.top_content) {
    add(f.url);
  }
  for (const u of Object.values(c.profiles)) {
    if (u) add(u);
  }
  return s;
}

const VALID_PLATFORMS = new Set<ResearchPlatformKey>([
  "website",
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "threads",
]);

type LlmHotContent = {
  id?: string;
  title?: string;
  summary?: string;
  formats?: string[];
  score?: number;
  score_breakdown?: Record<string, number>;
  evidence?: Array<{ url?: string; title?: string; kind?: string; note?: string }>;
  metric_signal?: { label?: string; value_text?: string; source?: string };
};

type LlmSocial = {
  channel?: string;
  profile_or_root_url?: string | null;
  hot_content?: LlmHotContent[];
};

type LlmBrand = {
  brand_id: string;
  name?: string;
  primary_domain?: string;
  brand_confidence?: number;
  tagline_guess?: string;
  socials?: LlmSocial[];
  /** Legacy shape from older prompts */
  channels?: Array<{
    platform?: string;
    profile_url?: string | null;
    topics?: Array<{
      topic_key?: string;
      headline?: string;
      angle?: string;
      content_formats?: string[];
      evidence?: Array<{ url?: string; title?: string; snippet?: string }>;
      metric_note?: { description?: string; source?: string };
      confidence?: number;
    }>;
  }>;
};

function mapLegacyChannelsToSocials(b: LlmBrand): SocialInsight[] {
  const out: SocialInsight[] = [];
  for (const ch of b.channels ?? []) {
    const channel = ch.platform as ResearchPlatformKey;
    if (!VALID_PLATFORMS.has(channel)) continue;
    const hot_content: HotContentInsight[] = (ch.topics ?? []).map((t) => {
      const evidence: HotContentEvidence[] = (t.evidence ?? [])
        .filter((e) => e?.url)
        .map((e) => ({
          url: String(e.url),
          title: e.title,
          kind: undefined,
          note: e.snippet,
        }));
      const mn = t.metric_note;
      return {
        id: String(t.topic_key || slugKey(String(t.headline))).slice(0, 64),
        title: String(t.headline || "Topic"),
        summary: String(t.angle || ""),
        formats: Array.isArray(t.content_formats)
          ? t.content_formats.map(String)
          : [],
        score: Math.round(
          typeof t.confidence === "number" && t.confidence <= 1
            ? t.confidence * 100
            : 70,
        ),
        evidence: evidence.length
          ? evidence
          : [{ url: "", title: "" }].filter((x) => x.url),
        metric_signal: {
          label: "Signal",
          value_text: mn?.description,
          source: normalizeMetricSource(mn?.source),
        },
      };
    });
    out.push({
      channel,
      profile_or_root_url: ch.profile_url ?? null,
      hot_content,
    });
  }
  return out;
}

function parseSocialsFromLlmBrand(b: LlmBrand): SocialInsight[] {
  if (Array.isArray(b.socials) && b.socials.length > 0) {
    return b.socials
      .filter((s) => s && VALID_PLATFORMS.has(s.channel as ResearchPlatformKey))
      .map((s) => {
        const channel = s.channel as ResearchPlatformKey;
        const hot_content: HotContentInsight[] = (s.hot_content ?? []).map(
          (h) => {
            const ms = h.metric_signal;
            return {
              id: String(h.id || slugKey(String(h.title))).slice(0, 64),
              title: String(h.title || "Content").slice(0, 400),
              summary: String(h.summary || "").slice(0, 2000),
              formats: Array.isArray(h.formats)
                ? h.formats.map(String).slice(0, 12)
                : ["mixed"],
              score:
                typeof h.score === "number" && h.score >= 0 && h.score <= 100
                  ? Math.round(h.score)
                  : 70,
              score_breakdown:
                h.score_breakdown &&
                typeof h.score_breakdown === "object" &&
                !Array.isArray(h.score_breakdown)
                  ? h.score_breakdown
                  : undefined,
              evidence: (h.evidence ?? [])
                .filter((e) => e?.url)
                .map((e) => ({
                  url: String(e.url),
                  title: e.title,
                  kind: e.kind,
                  note: e.note,
                })),
              metric_signal: {
                label: String(ms?.label || "Metric").slice(0, 120),
                value_text: ms?.value_text
                  ? String(ms.value_text).slice(0, 400)
                  : undefined,
                source: normalizeMetricSource(ms?.source),
              },
            };
          },
        );
        return {
          channel,
          profile_or_root_url:
            typeof s.profile_or_root_url === "string"
              ? s.profile_or_root_url
              : null,
          hot_content,
        };
      });
  }
  if (Array.isArray(b.channels) && b.channels.length > 0) {
    return mapLegacyChannelsToSocials(b);
  }
  return [];
}

/** Gọi OpenAI — output `brands[].socials[].hot_content[]` (URL evidence phải thuộc Tavily). */
export async function synthesizeBrandInsightsWithLlm(args: {
  niche: string;
  locale: string;
  competitors: CompetitorResult[];
}): Promise<BrandInsight[]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const payload = {
    niche: args.niche,
    locale: args.locale,
    brands: args.competitors.map((c) => ({
      brand_id: c.competitor_id,
      name: c.name,
      profiles: c.profiles,
      raw_findings: c.top_content.map((f) => ({
        platform: f.platform,
        url: f.url,
        title: f.title,
        format: f.format,
        score: f.score,
        badge: f.badge,
        why: f.why,
        metrics: f.metrics ?? {},
      })),
    })),
  };

  const system = `You are a content strategist. Output ONLY valid JSON. 
Rules:
- Shape: brands[].socials[].hot_content[] (see user schema).
- Every hot_content.evidence[].url MUST be copied from raw_findings for that brand OR be a profile URL from profiles.
- score for each hot_content is integer 0-100 (relative strength from evidence, not real reach).
- metric_signal: never claim API-measured reach unless source is measured; prefer from_snippet, inferred, or none.
- Merge similar raw_findings into one hot_content when same theme; max ~6 hot_content per social.`;

  const user = `Output JSON schema:
{
  "brands": [
    {
      "brand_id": string,
      "name": string,
      "primary_domain": string,
      "brand_confidence": number,
      "tagline_guess": string,
      "socials": [
        {
          "channel": "website"|"facebook"|"instagram"|"tiktok"|"youtube"|"threads",
          "profile_or_root_url": string|null,
          "hot_content": [
            {
              "id": string,
              "title": string,
              "summary": string,
              "formats": string[],
              "score": number,
              "score_breakdown": object optional,
              "evidence": [{ "url": string, "title"?: string, "kind"?: string, "note"?: string }],
              "metric_signal": { "label": string, "value_text"?: string, "source": "from_snippet"|"inferred"|"none"|"measured" }
            }
          ]
        }
      ]
    }
  ]
}

Input:
${JSON.stringify(payload).slice(0, 110000)}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned empty content");

  let parsed: { brands?: LlmBrand[] };
  try {
    parsed = JSON.parse(text) as { brands?: LlmBrand[] };
  } catch {
    throw new Error("OpenAI returned non-JSON");
  }

  const outBrands = parsed.brands;
  if (!Array.isArray(outBrands)) {
    throw new Error("OpenAI JSON missing brands array");
  }

  const byId = new Map(args.competitors.map((c) => [c.competitor_id, c]));

  const merged: BrandInsight[] = [];

  for (const b of outBrands) {
    const src = byId.get(b.brand_id);
    if (!src) continue;
    const allowed = allowedUrlsForBrand(src);

    let socials = parseSocialsFromLlmBrand(b);

    socials = socials
      .map((soc) => ({
        ...soc,
        hot_content: soc.hot_content
          .map((hc) => ({
            ...hc,
            evidence: hc.evidence.filter((e) => {
              if (!e.url?.trim()) return false;
              const raw = e.url.trim();
              if (allowed.has(raw)) return true;
              try {
                return allowed.has(new URL(raw).href);
              } catch {
                return false;
              }
            }),
          }))
          .filter((hc) => hc.evidence.length > 0),
      }))
      .filter((soc) => soc.hot_content.length > 0);

    merged.push({
      brand_id: b.brand_id,
      name: b.name || src.name,
      primary_domain: b.primary_domain || domainFromProfiles(src),
      brand_confidence:
        typeof b.brand_confidence === "number" &&
        b.brand_confidence >= 0 &&
        b.brand_confidence <= 1
          ? b.brand_confidence
          : src.confidence,
      tagline_guess:
        typeof b.tagline_guess === "string" ? b.tagline_guess.slice(0, 240) : undefined,
      socials,
      discovery_sources: src.discovery_sources,
    });
  }

  if (merged.length === 0) {
    throw new Error("LLM output produced no valid brands after validation");
  }

  const seen = new Set(merged.map((m) => m.brand_id));
  for (const c of args.competitors) {
    if (!seen.has(c.competitor_id)) {
      const one = buildHeuristicBrandInsights([c])[0];
      if (one) merged.push(one);
    }
  }

  return merged;
}

export async function synthesizeBrandInsights(args: {
  niche: string;
  locale: string;
  competitors: CompetitorResult[];
}): Promise<{ brands: BrandInsight[]; method: "llm" | "heuristic" }> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return {
      brands: buildHeuristicBrandInsights(args.competitors),
      method: "heuristic",
    };
  }
  try {
    const brands = await synthesizeBrandInsightsWithLlm(args);
    return { brands, method: "llm" };
  } catch {
    return {
      brands: buildHeuristicBrandInsights(args.competitors),
      method: "heuristic",
    };
  }
}
