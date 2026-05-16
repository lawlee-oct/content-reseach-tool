import { NextResponse } from "next/server";
import { callLLM, parseJsonResult } from "../../../lib/agentUtils";
import type { ReportItem } from "../../../lib/agentUtils";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.clusters)) {
    return NextResponse.json({ error: "Invalid request body. Expected { clusters: PatternCluster[] }." }, { status: 400 });
  }

  try {
    const clusters = body.clusters;
    const prompt = `You are a report writer for content strategy. Given the following cluster definitions, produce a JSON array of report items. Each report item should include:\n- patternName\n- titleTemplate\n- recommendedWordCount\n- headingStructureExample (array of headings)\n- exampleUrls (3 actual URLs if available)\n- seoNotes\n\nClusters:\n${JSON.stringify(clusters)}\nReturn valid JSON only.`;

    const responseText = await callLLM(prompt, 1200);
    const parsed = parseJsonResult<ReportItem[]>(responseText);
    return NextResponse.json({ report: parsed });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message || "Report generation failed." }, { status: 500 });
  }
}
