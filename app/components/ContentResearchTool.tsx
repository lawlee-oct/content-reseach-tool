"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import BrandCard from "./BrandCard";
import {
  allPlatforms,
  demoData,
  platformConfig,
  type PlatformKey,
} from "../constants/demoData";

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

const progressSteps = [
  { pct: 10, message: "🔍 Bắt đầu phân tích..." },
  { pct: 22, message: "🔍 Tìm thấy brands phù hợp..." },
  { pct: 38, message: "📊 Đang lấy dữ liệu SEO..." },
  { pct: 54, message: "📱 Đang phân tích nội dung mạng xã hội..." },
  { pct: 70, message: "🧠 AI đang đánh giá hiệu quả nội dung..." },
  { pct: 88, message: "✅ Hoàn thành phân tích! Đang hiển thị kết quả..." },
  {
    pct: 100,
    message: "✅ Done — 3 brands · 4 platforms · 12 content patterns",
  },
];

const defaultInputValues: InputValues = {
  niche: demoData.niche,
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
    "Nhập ngách hoặc brand để bắt đầu research.",
  );
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadedBrands, setLoadedBrands] = useState<typeof demoData.brands>([]);
  const timeoutIds = useRef<number[]>([]);

  const activeQuery = inputValues[currentMode] || demoData.niche;

  const selectedPlatformConfigs = useMemo(
    () => allPlatforms.filter((platform) => activePlatforms.includes(platform)),
    [activePlatforms],
  );

  const displayedBrands = hasSearched ? loadedBrands : [];

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

  const clearSearchTimers = () => {
    timeoutIds.current.forEach((id) => window.clearTimeout(id));
    timeoutIds.current = [];
  };

  useEffect(() => {
    return () => {
      clearSearchTimers();
    };
  }, []);

  const runDemo = () => {
    clearSearchTimers();
    setHasSearched(true);
    setProgress(0);
    setStatusMessage(`🔍 Đang tìm kiếm brands trong ngách ${activeQuery}...`);
    setIsSearching(true);
    setLoadedBrands([]);

    progressSteps.forEach((step, index) => {
      timeoutIds.current.push(
        window.setTimeout(
          () => {
            setProgress(step.pct);
            setStatusMessage(step.message);

            if (index === 1) {
              setLoadedBrands([demoData.brands[0]]);
            }

            if (index === 2) {
              setLoadedBrands([demoData.brands[0], demoData.brands[1]]);
            }

            if (index === 5) {
              setLoadedBrands(demoData.brands);
            }

            if (index === progressSteps.length - 1) {
              setIsSearching(false);
            }
          },
          600 * (index + 1),
        ),
      );
    });
  };

  // Helper for brand icon rendering
  function renderBrandIcon(brand: (typeof demoData.brands)[number]) {
    if (
      brand.url &&
      typeof brand.url === "string" &&
      brand.url.startsWith("/")
    ) {
      return (
        <Image
          src={brand.url}
          alt={`${brand.name} icon`}
          width={36}
          height={36}
          className="object-contain w-9 h-9 bg-white rounded-lg border border-slate-200"
          unoptimized
        />
      );
    }
    // fallback if icon is emoji or undefined
    return (
      <span className="text-2xl">{brand.url || brand.name.charAt(0)}</span>
    );
  }

  // Format chosen platform names to show the user
  const chosenPlatformLabels = activePlatforms.map(
    (platform) => platformConfig[platform]?.label,
  );

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
        <p className="mx-auto mt-4 max-w-[480px] text-sm leading-7 text-slate-600">
          Nhập ngách, brand, hoặc link sản phẩm — AI sẽ research và tìm ra
          content hiệu quả nhất trên mọi nền tảng.
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
                    AI sẽ tự crawl và extract thông tin sản phẩm, sau đó
                    research content liên quan
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
                  {/* icon is emoji or path */}
                  {"icon" in cfg && cfg.icon && cfg.icon.startsWith("/") ? (
                    <Image
                      src={cfg.icon}
                      alt={cfg.label}
                      width={18}
                      height={18}
                      className="object-contain w-4 h-4"
                      unoptimized
                    />
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

        {/* Thông báo các nền tảng đã được chọn */}
        <div className="mt-2 mb-2 flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold">Nền tảng đã chọn:</span>
          <span className="flex flex-wrap gap-1">
            {chosenPlatformLabels.length > 0 ? (
              chosenPlatformLabels.map((label, idx) => (
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
            <span>~1–2 phút · ~$0.35/research</span>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-br from-[#6c63ff] to-[#ff6b9d] px-7 py-3 text-sm font-semibold text-white transition hover:shadow-[0_8px_24px_rgba(108,99,255,0.4)]"
            type="button"
            onClick={runDemo}
          >
            Research Now <span className="text-lg">→</span>
          </button>
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-4">
        {isSearching ? (
          <div className="flex items-center gap-3 rounded-[12px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 shadow-sm">
            <span className="min-w-[120px]">{statusMessage}</span>
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

        {!isSearching && !hasSearched ? (
          <div className="rounded-[16px] bg-slate-50 px-6 py-12 text-center text-slate-500">
            <div className="text-4xl opacity-30">🔭</div>
            <p className="mt-3 text-sm leading-7">
              Nhập ngách hoặc brand để bắt đầu research.
              <br />
              AI sẽ tìm content hiệu quả nhất trên mọi nền tảng.
            </p>
          </div>
        ) : null}

        {(hasSearched || isSearching) &&
          displayedBrands.map((brand, index) => (
            <BrandCard
              key={brand.name}
              brand={{
                ...brand,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                url: renderBrandIcon(brand) as any, // pass down element as icon if needed
              }}
              activePlatforms={selectedPlatformConfigs}
              defaultOpen={index === 0}
            />
          ))}

        {isSearching &&
          Array.from(
            { length: Math.max(0, 3 - displayedBrands.length) },
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
          )}
      </div>
    </div>
  );
}
