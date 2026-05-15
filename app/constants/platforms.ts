/** UI + API filter keys for channels (aligned with `ResearchPlatformKey`). */
export type PlatformKey =
  | "website"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "threads"
  | "youtube";

export const allPlatforms: readonly PlatformKey[] = [
  "website",
  "facebook",
  "instagram",
  "tiktok",
  "threads",
  "youtube",
];

export const platformConfig: Record<
  PlatformKey,
  { icon: string; iconType: "img" | "text"; color: string; label: string }
> = {
  website: {
    icon: "/globe.svg",
    iconType: "img",
    color: "#3b82f6",
    label: "Website / SEO",
  },
  facebook: {
    icon: "/facebook.png",
    iconType: "img",
    color: "#1877f2",
    label: "Facebook",
  },
  instagram: {
    icon: "/instagram.png",
    iconType: "img",
    color: "#e1306c",
    label: "Instagram",
  },
  tiktok: {
    icon: "/tik_tok.png",
    iconType: "img",
    color: "#69c9d0",
    label: "TikTok",
  },
  threads: {
    icon: "🧵",
    iconType: "text",
    color: "#0f172a",
    label: "Threads",
  },
  youtube: {
    icon: "/youtube.svg",
    iconType: "img",
    color: "#ff0000",
    label: "YouTube",
  },
};
