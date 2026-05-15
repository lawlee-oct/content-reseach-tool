export type ResearchMode = "niche" | "brand" | "url";

/** Platforms we can surface in UI + filter research output. */
export type ResearchPlatformKey =
  | "website"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "threads"
  | "youtube";

export type ContentBadge = "high" | "med" | "low";

export type ResearchRequestBody = {
  mode: ResearchMode;
  /** niche string | brand name | product URL depending on mode */
  value: string;
  platforms: ResearchPlatformKey[];
  locale?: string;
  max_competitors?: number;
};

export type ProfileUrls = Partial<
  Record<ResearchPlatformKey, string | null>
>;

export type ContentFinding = {
  platform: ResearchPlatformKey;
  url: string;
  title: string;
  format: string;
  metrics?: Record<string, string>;
  score: number;
  badge: ContentBadge;
  why: string;
};

export type CompetitorResult = {
  competitor_id: string;
  name: string;
  confidence: number;
  discovery_sources: string[];
  profiles: ProfileUrls;
  top_content: ContentFinding[];
};

export type AggregateRow = {
  rank: number;
  competitor_id: string;
  competitor_name: string;
  platform: ResearchPlatformKey;
  url: string;
  title: string;
  score: number;
  badge: ContentBadge;
};

/** Nguồn gốc tín hiệu “metric” / độ hot. */
export type MetricSignalSource =
  | "measured"
  | "from_snippet"
  | "inferred"
  | "none";

export type HotContentEvidence = {
  url: string;
  title?: string;
  kind?: string;
  note?: string;
};

export type MetricSignal = {
  label: string;
  value_text?: string;
  source: MetricSignalSource;
};

/** Một cụm content/topic hot đã tổng hợp + chấm điểm (0–100). */
export type HotContentInsight = {
  id: string;
  title: string;
  summary: string;
  formats: string[];
  score: number;
  score_breakdown?: Record<string, number>;
  evidence: HotContentEvidence[];
  metric_signal: MetricSignal;
};

/** Một kênh social / website trong brand. */
export type SocialInsight = {
  channel: ResearchPlatformKey;
  profile_or_root_url: string | null;
  hot_content: HotContentInsight[];
};

/** Brand + danh sách kênh + hot content từng kênh. */
export type BrandInsight = {
  brand_id: string;
  name: string;
  primary_domain: string;
  /** 0–1 độ tin entity brand (discovery) */
  brand_confidence?: number;
  tagline_guess?: string;
  socials: SocialInsight[];
  discovery_sources?: string[];
};

export type ResearchSummary = {
  competitors_found: number;
  platforms_covered: ResearchPlatformKey[];
  /** Số dòng finding thô từ Tavily (trước gộp). */
  content_items_analyzed: number;
  /** Tổng số mục trong `brands[].socials[].hot_content`. */
  topic_insights_count: number;
  synthesis_method?: "llm" | "heuristic";
  notes: string[];
};

export type ResearchResponse = {
  research_job_id: string;
  input: {
    niche: string;
    locale: string;
    mode: ResearchMode;
    raw_value: string;
  };
  summary: ResearchSummary;
  competitors: CompetitorResult[];
  aggregate_top_content_for_niche: AggregateRow[];
  /** Luồng chính: `brands[]` → `socials[]` → `hot_content[]`. */
  brands: BrandInsight[];
};
