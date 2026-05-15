"use client";

import { useState } from "react";
import Image from "next/image";
import CompetitorResultCard from "./CompetitorResultCard";
import BrandInsightCard from "./BrandInsightCard";
import {
  allPlatforms,
  platformConfig,
  type PlatformKey,
} from "../constants/platforms";
import type { ResearchResponse } from "../lib/research/types";

type Mode = "niche" | "brand" | "url";

type InputValues = {
  niche: string;
  brand: string;
  url: string;
};

const tabs: Array<{
  key: Mode;
  label: string;
  icon: string;
  placeholder: string;
  hints?: string[];
}> = [
  {
    key: "niche",
    label: "Nhập Ngách",
    icon: "🏷️",
    placeholder: "vd: Home Decor, Fitness Equipment, Pet Accessories...",
    hints: [
      "Home Decor",
      "Fitness Equipment",
      "Pet Accessories",
      "Skincare",
      "Kitchen Gadgets",
    ],
  },
  {
    key: "brand",
    label: "Nhập Brand",
    icon: "🏢",
    placeholder: "vd: IKEA, Gymshark, Glossier...",
    hints: ["IKEA", "Gymshark", "Glossier"],
  },
  {
    key: "url",
    label: "Paste URL",
    icon: "🔗",
    placeholder: "https://amazon.com/dp/... hoặc bất kỳ URL sản phẩm nào",
  },
];

const defaultInputValues: InputValues = {
  niche: "",
  brand: "",
  url: "",
};

export default function ContentResearchTool() {
  const [currentMode, setCurrentMode] = useState<Mode>("niche");
  const [inputValues, setInputValues] =
    useState<InputValues>(defaultInputValues);
  const [activePlatforms, setActivePlatforms] = useState<PlatformKey[]>([
    "website",
    "facebook",
    "instagram",
    "tiktok",
  ]);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "Nhập ngách, brand, hoặc URL — pipeline sẽ tìm đối thủ, gom profile, rồi chấm điểm nội dung.",
  );
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [researchResult, setResearchResult] = useState<ResearchResponse | null>(
    null,
  );
  const [researchError, setResearchError] = useState<string | null>(null);

  const handleModeChange = (mode: Mode) => setCurrentMode(mode);

  const handleInputChange = (mode: Mode, value: string) => {
    setInputValues((prev) => ({ ...prev, [mode]: value }));
  };

  const togglePlatform = (platform: PlatformKey) => {
    setActivePlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  };

  const chosenPlatformLabels = activePlatforms.map(
    (platform) => platformConfig[platform]?.label,
  );

  const canSubmit =
    activePlatforms.length > 0 &&
    (currentMode === "niche"
      ? Boolean(inputValues.niche.trim())
      : currentMode === "brand"
        ? Boolean(inputValues.brand.trim())
        : Boolean(inputValues.url.trim()));

  const runResearch = async () => {
    if (!canSubmit) return;

    setResearchError(null);
    setResearchResult(null);
    setHasSearched(true);
    setIsSearching(true);
    setProgress(6);
    setStatusMessage("🔍 Đang chạy pipeline discovery + scoring…");

    const tick = window.setInterval(() => {
      setProgress((p) => (p >= 92 ? 92 : p + 5));
    }, 420);

    const value = inputValues[currentMode].trim();

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: currentMode,
          value,
          platforms: activePlatforms,
          locale: "en-US",
          max_competitors: 4,
        }),
      });

      const data = (await res.json()) as ResearchResponse & {
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        throw new Error(
          data.error ??
            `Lỗi HTTP ${res.status}${data.code ? ` (${data.code})` : ""}`,
        );
      }

      setResearchResult(data);
      setStatusMessage(
        `✅ Hoàn tất · ${data.summary.topic_insights_count} hot content · job ${data.research_job_id}`,
      );
      setProgress(100);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResearchError(message);
      setStatusMessage("Không thể hoàn tất research.");
      setProgress(0);
    } finally {
      window.clearInterval(tick);
      setIsSearching(false);
    }
  };

  return (
    <div className="relative z-10 mx-auto max-w-[960px] px-6 py-12 pb-20 text-slate-950">
      <header className="flex items-center justify-between mb-14">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563eb] to-[#ec4899] text-base">
            🔭
          </div>
          <div className="text-base font-[900] tracking-[-0.02em] font-[var(--font-syne)]">
            Content<span className="text-[#2563eb]">Scope</span>
          </div>
        </div>
        <div className="text-xs font-[var(--font-mono)] text-slate-500 uppercase tracking-[0.12em]">
          AI CONTENT RESEARCH v1.0
        </div>
      </header>

      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-[#2563eb]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb] animate-pulse" />
          AI-Powered Research
        </div>
        <h1 className="mt-6 text-[clamp(32px,5vw,52px)] font-[900] leading-[1.1] tracking-[-0.03em] text-slate-950">
          Discover{" "}
          <span className="bg-gradient-to-r from-[#2563eb] via-[#ec4899] to-[#14b8a6] bg-clip-text text-transparent">
            what content works
          </span>
          <br />
          in any niche
        </h1>
        <p className="mx-auto mt-4 max-w-[520px] text-sm leading-7 text-slate-600">
          Pipeline: <strong>ngách / brand / URL</strong> → tìm đối thủ & profile
          đa nền tảng → extract & search discovery → chấm điểm nội dung → trả
          list neo theo input.
        </p>
      </div>

      <section className="rounded-[20px] border border-slate-200 bg-white p-7 shadow-sm">
        <div className="mb-6 flex flex-wrap gap-2.5 rounded-[12px] bg-slate-100 p-1 text-sm">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-[9px] px-3 py-2 transition ${
                currentMode === tab.key
                  ? "bg-slate-900 text-white border border-slate-300 shadow-sm"
                  : "text-slate-500 hover:bg-slate-200 hover:text-slate-950"
              }`}
              onClick={() => handleModeChange(tab.key)}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={`${currentMode === tab.key ? "flex" : "hidden"} flex-col gap-3`}
          >
            <div className="flex flex-col gap-2">
              <label
                className="text-base uppercase tracking-[0.1em] text-[#8888aa]"
                htmlFor={`input-${tab.key}`}
              >
                {tab.key === "niche"
                  ? "Ngách sản phẩm"
                  : tab.key === "brand"
                    ? "Tên Brand"
                    : "URL sản phẩm"}
              </label>
              <input
                id={`input-${tab.key}`}
                className="w-full rounded-[10px] border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#bfdbfe]"
                type={tab.key === "url" ? "url" : "text"}
                placeholder={tab.placeholder}
                value={inputValues[tab.key]}
                onChange={(event) =>
                  handleInputChange(tab.key, event.target.value)
                }
              />
              {tab.hints ? (
                <div className="flex flex-wrap gap-2 text-[#8888aa]">
                  {tab.hints.map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] text-slate-600 transition hover:border-[#2563eb] hover:text-[#2563eb]"
                      onClick={() => handleInputChange(tab.key, hint)}
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              ) : tab.key === "url" ? (
                <div className="mt-2 flex items-center gap-2 text-[12px] text-[#8888aa]">
                  <span>💡</span>
                  <span>
                    URL mode: server extract nội dung trang (Tavily) để suy ra
                    query discovery tiếp theo.
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <span className="text-base">Chọn nền tảng</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allPlatforms.map((platform) => {
              const cfg = platformConfig[platform];
              const isActive = activePlatforms.includes(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] transition ${
                    isActive
                      ? "border-transparent bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-[#2563eb33] hover:text-slate-950"
                  }`}
                  onClick={() => togglePlatform(platform)}
                >
                  {cfg.iconType === "img" && cfg.icon.startsWith("/") ? (
                    <Image
                      src={cfg.icon}
                      alt={cfg.label}
                      width={18}
                      height={18}
                      className="object-contain w-4 h-4"
                      unoptimized
                    />
                  ) : cfg.iconType === "text" && cfg.icon ? (
                    <span className="text-[14px] leading-none">{cfg.icon}</span>
                  ) : (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: cfg.color }}
                    />
                  )}
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2 mb-2 flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold">Nền tảng đã chọn:</span>
          <span className="flex flex-wrap gap-1">
            {chosenPlatformLabels.length > 0 ? (
              chosenPlatformLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-[#eff6ff] border border-[#bfdbfe] px-2 py-0.5 text-[#2563eb] font-medium shadow-sm"
                >
                  {label}
                </span>
              ))
            ) : (
              <span className="text-slate-400 italic">Chưa chọn nền tảng nào</span>
            )}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[12px] text-[#8888aa]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
            <span>Live: Tavily Search + Extract — bắt buộc có TAVILY_API_KEY</span>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-br from-[#6c63ff] to-[#ff6b9d] px-7 py-3 text-sm font-semibold text-white transition hover:shadow-[0_8px_24px_rgba(108,99,255,0.4)] disabled:opacity-40 disabled:pointer-events-none"
            type="button"
            disabled={!canSubmit || isSearching}
            onClick={runResearch}
          >
            Research Now <span className="text-lg">→</span>
          </button>
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-4">
        {isSearching ? (
          <div className="flex items-center gap-3 rounded-[12px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">
            <span className="min-w-[120px] flex-1">{statusMessage}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-[#2563eb] to-[#14b8a6] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-[var(--font-mono)] text-[11px] text-slate-500">
              {progress}%
            </span>
          </div>
        ) : null}

        {researchError ? (
          <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {researchError}
          </div>
        ) : null}

        {!isSearching && !hasSearched ? (
          <div className="rounded-[16px] bg-slate-50 px-6 py-12 text-center text-slate-500">
            <div className="text-4xl opacity-30">🔭</div>
            <p className="mt-3 text-sm leading-7">
              Chọn mode, nhập dữ liệu, bấm Research Now.
              <br />
              Kết quả: <strong>brand → social → hot content</strong> (metric: snippet / suy
              luận). Raw Tavily nằm trong phần gập bên dưới.
            </p>
          </div>
        ) : null}

        {researchResult ? (
          <>
            <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-[700] text-slate-950">
                  Job summary
                </div>
                <div className="text-[11px] font-[var(--font-mono)] text-slate-500">
                  {researchResult.research_job_id} · mode{" "}
                  <span className="text-slate-700">{researchResult.input.mode}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div className="rounded-[10px] border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Brands
                  </div>
                  <div className="text-lg font-[800] text-slate-950">
                    {researchResult.summary.competitors_found}
                  </div>
                </div>
                <div className="rounded-[10px] border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Raw findings
                  </div>
                  <div className="text-lg font-[800] text-slate-950">
                    {researchResult.summary.content_items_analyzed}
                  </div>
                </div>
                <div className="rounded-[10px] border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Hot content
                  </div>
                  <div className="text-lg font-[800] text-slate-950">
                    {researchResult.summary.topic_insights_count}
                  </div>
                </div>
                <div className="rounded-[10px] border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    Tổng hợp
                  </div>
                  <div className="text-lg font-[800] text-slate-950 capitalize">
                    {researchResult.summary.synthesis_method === "llm"
                      ? "LLM"
                      : "Heuristic"}
                  </div>
                </div>
              </div>
              <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                {researchResult.summary.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-[700] text-slate-950 mb-3">
                Brand → social → hot content (score 0–100, evidence URL)
              </div>
              <div className="flex flex-col gap-4">
                {researchResult.brands.map((brand, index) => (
                  <BrandInsightCard
                    key={brand.brand_id}
                    brand={brand}
                    defaultOpen={index === 0}
                  />
                ))}
              </div>
            </div>

            <details className="group rounded-[16px] border border-slate-200 bg-slate-50/80 shadow-sm">
              <summary className="cursor-pointer select-none px-5 py-3 text-sm font-[600] text-slate-700 hover:bg-slate-100 rounded-[16px]">
                Raw Tavily (scores) — gập mặc định
              </summary>
              <div className="border-t border-slate-200 px-5 pb-5 pt-4 space-y-4">
                {researchResult.aggregate_top_content_for_niche.length > 0 ? (
                  <div>
                    <div className="text-xs font-[700] text-slate-600 mb-2">
                      Top theo điểm heuristic (SERP)
                    </div>
                    <div className="space-y-2">
                      {researchResult.aggregate_top_content_for_niche.map((row) => (
                        <div
                          key={`${row.rank}-${row.url}`}
                          className="flex flex-wrap items-start gap-3 rounded-[10px] border border-slate-100 bg-white px-3 py-2 text-sm"
                        >
                          <div className="font-[var(--font-mono)] text-xs text-slate-500 pt-0.5">
                            #{row.rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-slate-950 hover:text-[#2563eb]"
                            >
                              {row.title}
                            </a>
                            <div className="text-[11px] text-slate-500 mt-1">
                              {row.competitor_name} · {row.platform} · score{" "}
                              {row.score}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {researchResult.competitors.map((competitor) => (
                  <CompetitorResultCard
                    key={competitor.competitor_id}
                    competitor={competitor}
                    activePlatforms={activePlatforms}
                    defaultOpen={false}
                  />
                ))}
              </div>
            </details>
          </>
        ) : null}

        {isSearching ? (
          Array.from(
            {
              length: Math.max(
                0,
                3 - (researchResult?.brands?.length ?? 0),
              ),
            },
            (_, index) => (
              <div
                key={`skeleton-${index}`}
                className="rounded-[16px] bg-slate-50 border border-slate-200 p-5 animate-pulse"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-[10px] bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 w-4/12 rounded-full bg-slate-200" />
                    <div className="h-2.5 w-6/12 rounded-full bg-slate-200" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-2.5 rounded-full bg-slate-200" />
                  <div className="h-2.5 w-5/12 rounded-full bg-slate-200" />
                  <div className="h-2.5 w-3/12 rounded-full bg-slate-200" />
                </div>
              </div>
            ),
          )
        ) : null}
      </div>
    </div>
  );
}
