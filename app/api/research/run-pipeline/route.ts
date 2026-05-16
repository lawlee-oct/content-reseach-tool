import { NextResponse } from "next/server";
import {
  callLLM,
  crawlUrls,
  discoverBlogUrls,
  extractDomain,
  parseSeedKeywords,
  parseJsonResult,
  searchOrganicResults,
  sleep,
  type PatternCluster,
  type ReportItem,
} from "../../../lib/agentUtils";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ. Vui lòng gửi JSON." }, { status: 400 });
  }

  const { inputText, inputUrl, maxUrls = 80 } = body as {
    inputText?: string;
    inputUrl?: string;
    maxUrls?: number;
  };

  if (!inputText && !inputUrl) {
    return NextResponse.json(
      {
        error: "Cần ít nhất inputText hoặc inputUrl để chạy pipeline.",
      },
      { status: 400 },
    );
  }

  try {
    const finalMaxUrls = Math.min(Math.max(maxUrls, 50), 100);
    const result: {
      domain: string | null;
      seedKeywords: string[];
      serpResults: Record<string, unknown[]>;
      domains: string[];
      blogUrls: string[];
      crawlResults: unknown[];
      clusters: PatternCluster[];
      report: ReportItem[];
    } = {
      domain: null,
      seedKeywords: [],
      serpResults: {},
      domains: [],
      blogUrls: [],
      crawlResults: [],
      clusters: [],
      report: [],
    };

    const serpApiKey = process.env.SERPAPI_KEY;
    const llmKey = process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY;

    if (inputText) {
      let keywords = parseSeedKeywords(String(inputText), 5);
      if (keywords.length === 0 && llmKey) {
        const prompt = `Extract 5 strong seed keywords for SEO competitor discovery from the following text. Return a JSON array of strings only.\n\nText:\n${String(inputText)}`;
        const completion = await callLLM(prompt, 500);
        const parsed = JSON.parse(completion);
        if (Array.isArray(parsed)) {
          keywords = parsed.filter((item) => typeof item === "string").slice(0, 5);
        }
      }
      result.seedKeywords = keywords;

      if (!serpApiKey) {
        return NextResponse.json(
          {
            error: "SERPAPI_KEY không được cấu hình. Cần cho Agent 1.",
          },
          { status: 500 },
        );
      }

      for (const keyword of result.seedKeywords) {
        const serpHits = await searchOrganicResults(keyword, serpApiKey);
        result.serpResults[keyword] = serpHits;
        serpHits.forEach((item: any) => {
          if (item.domain) {
            result.domains.push(item.domain);
          }
        });
        await sleep(1200);
      }

      result.domains = Array.from(new Set(result.domains));
    }

    if (inputUrl) {
      const domain = extractDomain(String(inputUrl));
      result.domain = domain;
      const discovered = await discoverBlogUrls(domain, finalMaxUrls);
      result.blogUrls = discovered;
    }

    if (!inputUrl && result.domains.length > 0) {
      const discoveryTargets = result.domains.slice(0, 5);
      const discoveredUrls = new Set<string>();
      for (const targetDomain of discoveryTargets) {
        const discovered = await discoverBlogUrls(targetDomain, Math.ceil(finalMaxUrls / discoveryTargets.length));
        discovered.forEach((url) => discoveredUrls.add(url));
        await sleep(1200);
        if (discoveredUrls.size >= finalMaxUrls) break;
      }
      result.blogUrls = Array.from(discoveredUrls).slice(0, finalMaxUrls);
    }

    if (result.blogUrls.length === 0) {
      return NextResponse.json(
        {
          error: "Chưa tìm được URL bài viết nào. Vui lòng thử inputText keyword ngách khác hoặc nhập URL cụ thể.",
        },
        { status: 422 },
      );
    }

    const crawlResults = await crawlUrls(result.blogUrls.slice(0, finalMaxUrls), 3, 1200);
    result.crawlResults = crawlResults;

    const articlePayload = crawlResults.map((item) => ({
      url: item.url,
      title: item.title,
      structureHints: item.structureHints,
      wordCount: item.wordCount,
      metaDescription: item.metaDescription,
      headings: item.headings,
    }));

    const analyzePrompt = `You are a content research assistant. Given the following list of article metadata, cluster the articles into 15 to 20 distinct blog pattern groups. Output valid JSON only as an array of objects. Each object should include:\n- patternName\n- description\n- frequency\n- seoScore\n- examples (array of up to 3 { url, title })\n- patternTemplate\n- seoNotes\n\nArticles:\n${JSON.stringify(articlePayload)}\n`;

    const analyzeText = await callLLM(analyzePrompt, 1200);
    result.clusters = parseJsonResult<PatternCluster[]>(analyzeText);

    const reportPrompt = `You are a report generator for content strategy. Given the following patterns, produce a JSON array of report items. Each item should include:\n- patternName\n- titleTemplate\n- recommendedWordCount\n- headingStructureExample\n- exampleUrls\n- seoNotes\n\nPatterns:\n${JSON.stringify(result.clusters)}\nReturn valid JSON only.`;

    const reportText = await callLLM(reportPrompt, 1200);
    result.report = parseJsonResult<ReportItem[]>(reportText);

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: (error as Error).message || "Pipeline thất bại.",
      },
      { status: 500 },
    );
  }
}
