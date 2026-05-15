"use client";

import { useState } from "react";
import Image from "next/image";
import type { PlatformKey } from "../constants/platforms";
import { platformConfig } from "../constants/platforms";
import type {
  BrandInsight,
  MetricSignalSource,
  ResearchPlatformKey,
} from "../lib/research/types";

function PlatformIcon({ channel }: { channel: ResearchPlatformKey }) {
  const cfg = platformConfig[channel as PlatformKey];
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200">
      {cfg.iconType === "img" && cfg.icon.startsWith("/") ? (
        <Image
          src={cfg.icon}
          alt={cfg.label}
          width={20}
          height={20}
          className="object-contain w-5 h-5"
          unoptimized
        />
      ) : cfg.iconType === "text" && cfg.icon ? (
        <span className="text-[16px] leading-none">{cfg.icon}</span>
      ) : (
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: cfg.color }}
        />
      )}
    </div>
  );
}

function metricSourceLabel(s: MetricSignalSource): string {
  switch (s) {
    case "measured":
      return "Đo được";
    case "from_snippet":
      return "Snippet";
    case "inferred":
      return "Suy luận";
    default:
      return "Không có số";
  }
}

function metricSourceStyle(s: MetricSignalSource): string {
  switch (s) {
    case "measured":
      return "bg-emerald-100 text-emerald-900";
    case "from_snippet":
      return "bg-sky-100 text-sky-900";
    case "inferred":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function scoreTone(score: number): string {
  if (score >= 85) return "from-emerald-500 to-teal-600";
  if (score >= 72) return "from-[#2563eb] to-indigo-600";
  return "from-slate-500 to-slate-600";
}

type BrandInsightCardProps = {
  brand: BrandInsight;
  defaultOpen?: boolean;
};

export default function BrandInsightCard({
  brand,
  defaultOpen = false,
}: BrandInsightCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const totalHot = brand.socials.reduce((n, s) => n + s.hot_content.length, 0);

  return (
    <div className="rounded-[16px] border border-slate-200 bg-white shadow-sm overflow-hidden ring-1 ring-slate-900/5">
      <button
        type="button"
        className="flex w-full items-stretch gap-0 text-left transition hover:bg-slate-50/80"
        onClick={() => setOpen((v) => !v)}
      >
        <div
          className="w-1 shrink-0 bg-gradient-to-b from-[#2563eb] to-[#ec4899]"
          aria-hidden
        />
        <div className="flex flex-1 items-center justify-between gap-3 px-4 py-4 min-w-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-[900] text-slate-950 truncate">
                {brand.name}
              </span>
              {typeof brand.brand_confidence === "number" ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-[var(--font-mono)] text-slate-600">
                  brand {Math.round(brand.brand_confidence * 100)}%
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-xs font-[var(--font-mono)] text-slate-500 truncate">
              {brand.primary_domain}
            </div>
            {brand.tagline_guess ? (
              <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">
                {brand.tagline_guess}
              </p>
            ) : null}
            <div className="mt-2 text-[11px] text-slate-500">
              {brand.socials.length} kênh · {totalHot} hot content
            </div>
          </div>
          <span className="text-slate-400 text-sm shrink-0 pr-1">
            {open ? "▴" : "▾"}
          </span>
        </div>
      </button>

      <div className={open ? "block" : "hidden"}>
        {brand.socials.map((soc) => (
          <section
            key={`${brand.brand_id}-${soc.channel}`}
            className="border-t border-slate-200"
          >
            <div className="flex flex-wrap items-start gap-3 bg-slate-50 px-4 py-3">
              <PlatformIcon channel={soc.channel} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-[800] text-slate-900">
                  {platformConfig[soc.channel as PlatformKey]?.label ?? soc.channel}
                </div>
                {soc.profile_or_root_url ? (
                  <a
                    href={soc.profile_or_root_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-[11px] text-[#2563eb] hover:underline break-all"
                  >
                    {soc.profile_or_root_url}
                  </a>
                ) : (
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Chưa có URL kênh
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {soc.hot_content.map((hc) => (
                <article
                  key={`${brand.brand_id}-${soc.channel}-${hc.id}`}
                  className="px-4 py-4 flex flex-col sm:flex-row gap-4"
                >
                  <div
                    className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br ${scoreTone(hc.score)} text-white shadow-md`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
                      Score
                    </span>
                    <span className="text-xl font-black leading-none">{hc.score}</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <h4 className="text-sm font-[800] text-slate-950 leading-snug">
                      {hc.title}
                    </h4>
                    <p className="text-xs leading-6 text-slate-600">{hc.summary}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {hc.formats.map((fmt) => (
                        <span
                          key={fmt}
                          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {fmt}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${metricSourceStyle(hc.metric_signal.source)}`}
                      >
                        {metricSourceLabel(hc.metric_signal.source)}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-800">
                        {hc.metric_signal.label}
                      </span>
                      {hc.metric_signal.value_text ? (
                        <span className="text-[11px] text-slate-600">
                          — {hc.metric_signal.value_text}
                        </span>
                      ) : null}
                    </div>
                    {hc.score_breakdown &&
                    Object.keys(hc.score_breakdown).length > 0 ? (
                      <div className="flex flex-wrap gap-2 text-[10px] font-[var(--font-mono)] text-slate-500">
                        {Object.entries(hc.score_breakdown).map(([k, v]) => (
                          <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5">
                            {k}: {(v * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400 mb-1">
                        Evidence
                      </div>
                      <ul className="space-y-1">
                        {hc.evidence.map((ev) => (
                          <li key={ev.url}>
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#2563eb] hover:underline break-all"
                            >
                              {ev.title || ev.url}
                            </a>
                            {ev.note ? (
                              <span className="block text-[10px] text-slate-500 mt-0.5">
                                {ev.note}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
