import { NextResponse } from "next/server";
import { callLLM, parseJsonResult } from "../../../lib/agentUtils";
import type { PatternCluster } from "../../../lib/agentUtils";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.articles)) {
    return NextResponse.json({ error: "Invalid request body. Expected { articles: CrawlResult[] }." }, { status: 400 });
  }

  try {
    const articles = body.articles;
    const prompt = `Analyze the following array of article metadata and cluster the data into 15 to 20 distinct blog content pattern groups. Output valid JSON only as an array of clusters. Each cluster object should have these properties:\n- patternName: short descriptive label\n- description: what type of article this pattern represents\n- frequency: how common this cluster is in the sample\n- seoScore: integer 1-100 for SEO potential\n- examples: array of up to 3 objects { url, title }\n- patternTemplate: an example title template if available\n- seoNotes: short SEO guidance for this pattern\n\nData:\n${JSON.stringify(articles)}\n`;

    const responseText = await callLLM(prompt, 1200);
    const parsed = parseJsonResult<PatternCluster[]>(responseText);

    return NextResponse.json({ clusters: parsed });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message || "Pattern analysis failed." }, { status: 500 });
  }
}

// Avoid importing CrawlResult type here directly to prevent circular type dependencies in Next route evaluation
type CrawlResult = {
  url: string;
  title: string | null;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  wordCount: number;
  metaDescription: string | null;
  canonical: string | null;
  internalLinkCount: number;
  structureHints: string[];
};
