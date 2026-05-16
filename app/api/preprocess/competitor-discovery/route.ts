import { NextResponse } from "next/server";
import {
  CompetitorDiscoveryOutput,
  callLLM,
  discoverBlogUrls,
  extractDomain,
  extractKeywordsFromText,
  searchOrganicResults,
  sleep,
} from "../../../lib/agentUtils";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || (typeof body !== "object")) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { inputText, inputUrl, maxUrls = 100 } = body as {
    inputText?: string;
    inputUrl?: string;
    maxUrls?: number;
  };

  if (!inputText && !inputUrl) {
    return NextResponse.json({ error: "inputText or inputUrl is required." }, { status: 400 });
  }

  const serpApiKey = process.env.SERPAPI_KEY;
  const result: CompetitorDiscoveryOutput = {
    domain: null,
    seedKeywords: [],
    serpResults: {},
    blogUrls: [],
  };

  try {
    if (inputText) {
      let keywords = extractKeywordsFromText(String(inputText), 5);
      if (keywords.length < 3 && process.env.OPENAI_API_KEY) {
        const prompt = `Extract 5 strong seed keywords for SEO competitor discovery from the following text. Return a JSON array of strings only.\n\nText:\n${String(inputText)}`;
        const completion = await callLLM(prompt, 500);
        const parsed = JSON.parse(completion);
        if (Array.isArray(parsed)) {
          keywords = parsed.filter((item) => typeof item === "string").slice(0, 5);
        }
      }
      result.seedKeywords = keywords;

      if (!serpApiKey) {
        return NextResponse.json({ error: "SERPAPI_KEY is required for keyword organic search." }, { status: 500 });
      }

      for (const keyword of result.seedKeywords) {
        const serpHits = await searchOrganicResults(keyword, serpApiKey);
        result.serpResults[keyword] = serpHits;
        await sleep(1200);
      }
    }

    if (inputUrl) {
      const domain = extractDomain(String(inputUrl));
      result.domain = domain;
      result.blogUrls = await discoverBlogUrls(domain, Math.min(Math.max(maxUrls, 50), 100));
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message || "Unknown error" }, { status: 500 });
  }
}
