export type PlatformKey =
  | "website"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube";

export type ContentItem = {
  title: string;
  type: string;
  kw?: string;
  eng?: string;
  views?: string;
  score: number;
  badge: "high" | "med" | "low";
};

export type Brand = {
  name: string;
  abbr: string;
  color: string;
  url: string;
  niche: string;
  platforms: Record<PlatformKey, ContentItem[]>;
};

export const allPlatforms: readonly PlatformKey[] = [
  "website",
  "facebook",
  "instagram",
  "tiktok",
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
  youtube: {
    icon: "/youtube.svg",
    iconType: "img",
    color: "#ff0000",
    label: "YouTube",
  },
};

export const demoData = {
  niche: "Home Decor",
  brands: [
    {
      name: "Wayfair",
      abbr: "WF",
      color: "#9333ea",
      url: "wayfair.com",
      niche: "Home Decor",
      platforms: {
        website: [
          { title: "10 Best Living Room Decor Ideas for Small Spaces (2024)", type: "Listicle", kw: "8.2K/mo", score: 94, badge: "high" },
          { title: "How to Style a Minimalist Bedroom on a Budget", type: "How-to Guide", kw: "5.4K/mo", score: 87, badge: "high" },
          { title: "Best Accent Chairs Under $300: Editor Picks", type: "Product Review", kw: "3.1K/mo", score: 78, badge: "med" },
        ],
        facebook: [
          { title: "Before/After: Studio Apartment Transformation (Video)", type: "Video Post", eng: "12.4K likes", score: 91, badge: "high" },
          { title: "\"Tag a friend who needs this\" + product carousel", type: "Engagement Post", eng: "8.7K reactions", score: 82, badge: "high" },
          { title: "Flash Sale Countdown: 48 hours only", type: "Sales Post", eng: "5.2K clicks", score: 71, badge: "med" },
        ],
        instagram: [
          { title: "Room makeover reel: POV you have $200 to spend", type: "Reel", eng: "284K views", score: 96, badge: "high" },
          { title: "Aesthetic shelf styling — step by step carousel", type: "Carousel", eng: "42K saves", score: 88, badge: "high" },
          { title: "\"Cozy corner\" flat lay with affiliate links in bio", type: "Static Post", eng: "18K likes", score: 73, badge: "med" },
        ],
        tiktok: [
          { title: "POV: Decorating my first apartment for under $500", type: "Story Hook", views: "2.1M", score: 97, badge: "high" },
          { title: "Things I regret buying vs things worth it", type: "Comparison", views: "890K", score: 84, badge: "high" },
          { title: "Duet with @interior_inspo on lamp placement", type: "Duet Format", views: "430K", score: 69, badge: "med" },
        ],
        youtube: [],
      },
    },
    {
      name: "West Elm",
      abbr: "WE",
      color: "#0891b2",
      url: "westelm.com",
      niche: "Home Decor",
      platforms: {
        website: [
          { title: "Mid-Century Modern Furniture: Complete Style Guide", type: "Style Guide", kw: "11K/mo", score: 92, badge: "high" },
          { title: "How to Mix and Match Throw Pillows (Designer Tips)", type: "Tips Article", kw: "4.8K/mo", score: 81, badge: "high" },
        ],
        facebook: [
          { title: "New season collection launch + swipe-to-shop", type: "Collection Drop", eng: "9.3K clicks", score: 85, badge: "high" },
          { title: "Interior designer Q&A: Live stream replay", type: "Live Content", eng: "6.1K views", score: 76, badge: "med" },
        ],
        instagram: [
          { title: "Seasonal refresh: living room color palette 2024", type: "Carousel", eng: "56K saves", score: 93, badge: "high" },
          { title: "\"Rate my room\" UGC repost with product tag", type: "UGC Post", eng: "31K likes", score: 79, badge: "med" },
        ],
        tiktok: [
          { title: "Honest review: is West Elm worth the price?", type: "Review Hook", views: "1.4M", score: 89, badge: "high" },
          { title: "Styling the same shelf 3 different ways", type: "Transformation", views: "670K", score: 77, badge: "med" },
        ],
        youtube: [],
      },
    },
    {
      name: "Article",
      abbr: "AR",
      color: "#16a34a",
      url: "article.com",
      niche: "Home Decor",
      platforms: {
        website: [
          { title: "Scandinavian Interior Design: 7 Key Principles", type: "Educational", kw: "6.9K/mo", score: 88, badge: "high" },
          { title: "Sofa Buying Guide: What to Look for in 2024", type: "Buying Guide", kw: "9.2K/mo", score: 90, badge: "high" },
        ],
        facebook: [
          { title: "Customer home tour: real people, real results", type: "Social Proof", eng: "11.2K shares", score: 92, badge: "high" },
        ],
        instagram: [
          { title: "\"Unboxing + first impressions\" sofa delivery reel", type: "Unboxing Reel", eng: "198K views", score: 86, badge: "high" },
        ],
        tiktok: [
          { title: "I ordered furniture online and this is what happened", type: "Story Format", views: "3.2M", score: 98, badge: "high" },
        ],
        youtube: [],
      },
    },
  ] as Brand[],
} as const;
