import { NextResponse } from "next/server";
import { runResearch } from "@/app/lib/research/pipeline";
import type {
  ResearchPlatformKey,
  ResearchRequestBody,
} from "@/app/lib/research/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const PLATFORM_SET = new Set<ResearchPlatformKey>([
  "website",
  "facebook",
  "instagram",
  "tiktok",
  "threads",
  "youtube",
]);

function normalizePlatforms(
  value: unknown,
): ResearchPlatformKey[] {
  if (!Array.isArray(value)) {
    return ["website", "instagram", "tiktok", "facebook"];
  }
  const out = value.filter(
    (p): p is ResearchPlatformKey =>
      typeof p === "string" && PLATFORM_SET.has(p as ResearchPlatformKey),
  );
  return out.length > 0
    ? out
    : ["website", "instagram", "tiktok", "facebook"];
}

export async function POST(request: Request) {
  let body: Partial<ResearchRequestBody>;
  try {
    body = (await request.json()) as Partial<ResearchRequestBody>;
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", error: "Body không phải JSON hợp lệ." },
      { status: 400 },
    );
  }

  const mode = body.mode;
  const value = typeof body.value === "string" ? body.value.trim() : "";

  if (mode !== "niche" && mode !== "brand" && mode !== "url") {
    return NextResponse.json(
      {
        code: "INVALID_MODE",
        error: "mode phải là niche, brand hoặc url.",
      },
      { status: 400 },
    );
  }

  if (!value) {
    return NextResponse.json(
      {
        code: "MISSING_VALUE",
        error: "Thiếu value — nhập ngách, brand hoặc URL tùy mode.",
      },
      { status: 400 },
    );
  }

  if (mode === "url") {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json(
          {
            code: "INVALID_URL",
            error: "URL phải bắt đầu bằng http:// hoặc https://",
          },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json(
        { code: "INVALID_URL", error: "URL không hợp lệ." },
        { status: 400 },
      );
    }
  }

  const payload: ResearchRequestBody = {
    mode,
    value,
    platforms: normalizePlatforms(body.platforms),
    locale: typeof body.locale === "string" ? body.locale : "en-US",
    max_competitors:
      typeof body.max_competitors === "number" && body.max_competitors > 0
        ? Math.min(8, Math.floor(body.max_competitors))
        : undefined,
  };

  if (!process.env.TAVILY_API_KEY?.trim()) {
    return NextResponse.json(
      {
        code: "MISSING_TAVILY_API_KEY",
        error:
          "Chưa cấu hình TAVILY_API_KEY. Tạo .env.local trong thư mục gốc project và thêm key (xem README.md).",
      },
      { status: 503 },
    );
  }

  try {
    const result = await runResearch(payload);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { code: "RESEARCH_FAILED", error: message },
      { status: 502 },
    );
  }
}
