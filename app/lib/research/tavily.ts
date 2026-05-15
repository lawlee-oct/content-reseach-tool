export type TavilySearchHit = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

export type TavilySearchResponse = {
  query: string;
  results: TavilySearchHit[];
  response_time?: number;
};

export type TavilyExtractHit = {
  url: string;
  raw_content?: string;
  content?: string;
};

export type TavilyExtractResponse = {
  results: TavilyExtractHit[];
  failed_results?: { url: string; error: string }[];
};

const TAVILY_SEARCH = "https://api.tavily.com/search";
const TAVILY_EXTRACT = "https://api.tavily.com/extract";

export async function tavilySearch(
  apiKey: string,
  query: string,
  options?: { maxResults?: number; searchDepth?: "basic" | "advanced" },
): Promise<TavilySearchResponse> {
  const res = await fetch(TAVILY_SEARCH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: options?.searchDepth ?? "basic",
      max_results: options?.maxResults ?? 10,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily search failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as TavilySearchResponse;
  return {
    ...data,
    results: Array.isArray(data.results) ? data.results : [],
  };
}

export async function tavilyExtract(
  apiKey: string,
  urls: string[],
): Promise<TavilyExtractResponse> {
  if (urls.length === 0) {
    return { results: [] };
  }

  const res = await fetch(TAVILY_EXTRACT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      urls: urls.slice(0, 20),
      format: "text",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily extract failed (${res.status}): ${text.slice(0, 400)}`);
  }

  return res.json() as Promise<TavilyExtractResponse>;
}
