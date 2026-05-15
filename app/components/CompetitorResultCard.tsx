"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { PlatformKey } from "../constants/platforms";
import { platformConfig } from "../constants/platforms";
import type {
  CompetitorResult,
  ContentFinding,
  ResearchPlatformKey,
} from "../lib/research/types";

type CompetitorResultCardProps = {
  competitor: CompetitorResult;
  activePlatforms: ResearchPlatformKey[];
  defaultOpen?: boolean;
};

function PlatformHeader({ platform }: { platform: ResearchPlatformKey }) {
  const cfg = platformConfig[platform as PlatformKey];
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center rounded-[7px] text-xs font-[700] text-white">
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
          <span className="text-[15px] leading-none">{cfg.icon}</span>
        ) : (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: cfg.color }}
          />
        )}
      </div>
      <div className="text-sm font-[600] text-slate-950">{cfg.label}</div>
    </div>
  );
}

function metricsLine(platform: ResearchPlatformKey, item: ContentFinding) {
  const m = item.metrics ?? {};
  const parts: React.ReactNode[] = [];
  if (platform === "website" && m.volume) {
    parts.push(<span key="v">📈 {m.volume}</span>);
  }
  if (
    platform !== "website" &&
    platform !== "youtube" &&
    platform !== "tiktok" &&
    platform !== "threads" &&
    m.engagement
  ) {
    parts.push(<span key="e">❤️ {m.engagement}</span>);
  }
  if ((platform === "instagram" || platform === "threads") && m.engagement) {
    parts.push(<span key="i">👁 {m.engagement}</span>);
  }
  if ((platform === "tiktok" || platform === "youtube") && m.views) {
    parts.push(<span key="t">▶️ {m.views} views</span>);
  }
  if (m.source) {
    parts.push(
      <span key="s" className="font-[var(--font-mono)]">
        src: {m.source}
      </span>,
    );
  }
  parts.push(<span key="f">📝 {item.format}</span>);
  return parts;
}

export default function CompetitorResultCard({
  competitor,
  activePlatforms,
  defaultOpen = false,
}: CompetitorResultCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const visibleCount = useMemo(
    () =>
      competitor.top_content.filter((i) =>
        activePlatforms.includes(i.platform),
      ).length,
    [competitor.top_content, activePlatforms],
  );

  const grouped = useMemo(() => {
    const map = new Map<ResearchPlatformKey, ContentFinding[]>();
    for (const item of competitor.top_content) {
      if (!activePlatforms.includes(item.platform)) continue;
      if (!map.has(item.platform)) map.set(item.platform, []);
      map.get(item.platform)!.push(item);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [competitor.top_content, activePlatforms]);

  const profileEntries = (
    Object.entries(competitor.profiles) as [
      ResearchPlatformKey,
      string | null | undefined,
    ][]
  ).filter(([, url]) => Boolean(url));

  return (
    <div className="rounded-[16px] border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
        onClick={() => setIsOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-slate-900 text-sm font-[900] text-white">
            {competitor.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-[700] text-slate-950 truncate">
              {competitor.name}
            </div>
            <div className="text-xs font-[var(--font-mono)] text-slate-500 truncate">
              id {competitor.competitor_id} · confidence{" "}
              {Math.round(competitor.confidence * 100)}% · {visibleCount}{" "}
              findings
            </div>
          </div>
        </div>
        <span className="text-xs text-slate-500 shrink-0">
          {isOpen ? "▴" : "▾"}
        </span>
      </button>

      {profileEntries.length > 0 ? (
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 mb-2">
            Profiles discovered
          </div>
          <div className="flex flex-wrap gap-2">
            {profileEntries.map(([key, url]) => (
              <a
                key={key}
                href={url!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-[#2563eb] hover:border-[#2563eb]"
              >
                {platformConfig[key as PlatformKey]?.label ?? key}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div className={isOpen ? "block" : "hidden"}>
        {grouped.length === 0 ? (
          <div className="border-t border-slate-200 px-5 py-6 text-sm text-slate-500">
            Không có nội dung cho các nền tảng đã chọn.
          </div>
        ) : (
          grouped.map(([platform, items]) => (
            <section key={platform} className="border-t border-slate-200">
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <PlatformHeader platform={platform} />
                <div className="ml-auto text-[11px] font-[var(--font-mono)] text-slate-500">
                  {items.length} items
                </div>
              </div>
              <div className="space-y-3 px-5 pb-5">
                {items.map((item, index) => {
                  const badgeColor =
                    item.badge === "high"
                      ? "bg-[rgba(20,184,166,0.16)] text-[#0f766e]"
                      : item.badge === "med"
                        ? "bg-[rgba(37,99,235,0.12)] text-[#2563eb]"
                        : "bg-slate-200 text-slate-500";
                  return (
                    <article
                      key={`${platform}-${item.url}-${index}`}
                      className="flex gap-3 rounded-[10px] border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300"
                    >
                      <div className="min-w-[20px] text-[11px] font-[var(--font-mono)] text-slate-500 pt-1">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium leading-5 text-slate-950 hover:text-[#2563eb]"
                        >
                          {item.title}
                        </a>
                        <p className="mt-2 text-[11px] leading-5 text-slate-600">
                          {item.why}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          {metricsLine(platform, item)}
                          <span
                            className={`rounded-[4px] px-2 py-1 ${badgeColor}`}
                          >
                            {item.badge === "high"
                              ? "High"
                              : item.badge === "med"
                                ? "Medium"
                                : "Low"}
                          </span>
                        </div>
                      </div>
                      <div className="flex min-w-[80px] flex-col items-end gap-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#14b8a6]"
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.score}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
