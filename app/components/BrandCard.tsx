"use client";

import { useState } from "react";
import type { Brand, PlatformKey } from "../constants/demoData";
import { platformConfig } from "../constants/demoData";
import Image from "next/image";

type BrandCardProps = {
  brand: Brand;
  activePlatforms: PlatformKey[];
  defaultOpen?: boolean;
};

export default function BrandCard({
  brand,
  activePlatforms,
  defaultOpen = false,
}: BrandCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const visiblePlatforms = Object.entries(brand.platforms).filter(
    ([platform]) => activePlatforms.includes(platform as PlatformKey),
  ) as [PlatformKey, Brand["platforms"][PlatformKey]][];

  return (
    <div className="rounded-[16px] border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
        onClick={() => setIsOpen((value) => !value)}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-[10px] text-sm font-[900] text-white"
            style={{ background: brand.color }}
          >
            {brand.abbr}
          </div>
          <div>
            <div className="text-sm font-[700] text-slate-950">
              {brand.name}
            </div>
            <div className="text-xs font-[var(--font-mono)] text-slate-500">
              {brand.url} ·{" "}
              {visiblePlatforms.reduce(
                (count, [, items]) => count + items.length,
                0,
              )}{" "}
              content patterns
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{isOpen ? "▴" : "▾"}</span>
        </div>
      </button>

      <div className={isOpen ? "block" : "hidden"}>
        {visiblePlatforms.map(([platform, items]) => {
          const cfg = platformConfig[platform];
          return (
            <section key={platform} className="border-t border-slate-200">
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center rounded-[7px] text-xs font-[700] text-white">
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
                  </div>
                  <div className="text-sm font-[600] text-slate-950">
                    {cfg.label}
                  </div>
                </div>
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
                      key={`${platform}-${index}`}
                      className="flex gap-3 rounded-[10px] border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300"
                    >
                      <div className="min-w-[20px] text-[11px] font-[var(--font-mono)] text-slate-500 pt-1">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium leading-5 text-slate-950">
                          {item.title}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          {platform === "website" && <span>📈 {item.kw}</span>}
                          {platform !== "website" &&
                            platform !== "youtube" &&
                            platform !== "tiktok" && <span>❤️ {item.eng}</span>}
                          {platform === "instagram" && (
                            <span>👁 {item.eng}</span>
                          )}
                          {(platform === "tiktok" ||
                            platform === "youtube") && (
                            <span>▶️ {item.views} views</span>
                          )}
                          <span>📝 {item.type}</span>
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
          );
        })}
      </div>
    </div>
  );
}
