import { NextResponse } from "next/server";
import { crawlUrls } from "../../../lib/agentUtils";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.urls)) {
    return NextResponse.json({ error: "Invalid request body. Expected { urls: string[] }." }, { status: 400 });
  }

  const urls = body.urls as string[];
  if (urls.length === 0) {
    return NextResponse.json({ error: "The urls array must contain at least one URL." }, { status: 400 });
  }

  try {
    const results = await crawlUrls(urls, 3, 1200);
    return NextResponse.json({ results });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message || "Crawler failed." }, { status: 500 });
  }
}
