# Blog Research Tool

Công cụ phân tích competitor và gợi ý **15–20 dạng bài blog có SEO tốt**, tích hợp vào NextJS app có sẵn.

Input vào brand/niche hoặc URL → hệ thống tự động tìm competitor → crawl 50–100 bài blog → AI phân tích patterns → xuất danh sách blog types kèm evidence.

---

## Kiến trúc tổng quan

```
Input (text/URL)
  → Agent 1: Competitor Discovery   [SerpAPI]
  → Agent 2: Content Crawler        [fetch + HTML parsing]
  → Agent 3: Pattern Analyzer       [Gemini 1.5 Flash]
  → Agent 4: Report Generator       [Gemini 1.5 Flash]
  → Output: 15–20 Blog Types + Evidence
```

Progress được stream realtime về UI qua **Server-Sent Events (SSE)**.

---

## Cấu trúc files cần thêm vào NextJS project

```
src/
├── types/
│   └── index.ts                          ← TypeScript types toàn hệ thống
├── lib/
│   ├── job-store.ts                      ← In-memory job manager
│   └── agents/
│       ├── agent1-discovery.ts           ← Tìm competitor domains + blog URLs
│       ├── agent2-crawler.ts             ← Crawl và extract nội dung
│       ├── agent3-analyzer.ts            ← AI phân tích patterns (Gemini)
│       ├── agent4-report.ts              ← AI tạo báo cáo chi tiết (Gemini)
│       └── job-runner.ts                 ← Orchestrate 4 agents
├── hooks/
│   └── useResearch.ts                    ← React hook cho UI
├── components/
│   └── BlogResearcher.tsx                ← UI component sẵn dùng
└── app/
    └── api/
        └── research/
            ├── start/
            │   └── route.ts              ← POST: tạo job
            └── stream/
                └── [jobId]/
                    └── route.ts          ← GET: SSE stream progress
```

---

## Setup từng bước

### Bước 1 — Copy files vào project

Copy toàn bộ cấu trúc trên vào NextJS project của bạn. Giữ nguyên đường dẫn.

### Bước 2 — Cài dependencies

```bash
npm install
# Không cần cài thêm package nào — chỉ dùng fetch native của Node 18+
```

> **Lưu ý:** Yêu cầu **Node.js 18+** vì dùng `fetch` native và `AbortSignal.timeout()`.
> Kiểm tra: `node --version` phải là `v18.x` trở lên.

### Bước 3 — Tạo file .env.local

```bash
cp .env.local.example .env.local
```

Sau đó điền 2 API keys vào `.env.local`:

```env
SERPAPI_KEY=your_serpapi_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

**Lấy SerpAPI key:**
1. Đăng nhập tại [serpapi.com](https://serpapi.com)
2. Vào Dashboard → API Key
3. Copy key dán vào `SERPAPI_KEY`

**Lấy Gemini API key (miễn phí):**
1. Vào [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Đăng nhập Google account
3. Nhấn **"Create API key"**
4. Copy key dán vào `GEMINI_API_KEY`
5. Free tier: **15 requests/phút**, **1 triệu tokens/ngày** — đủ dùng thoải mái

### Bước 4 — Kiểm tra tsconfig paths

Đảm bảo `tsconfig.json` có path alias `@/`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Nếu chưa có, thêm vào. NextJS mặc định đã có nếu bạn chọn alias khi `create-next-app`.

### Bước 5 — Dùng component

Thêm vào bất kỳ page nào trong NextJS app:

```tsx
// app/research/page.tsx (hoặc bất kỳ page nào)
import BlogResearcher from '@/components/BlogResearcher'

export default function ResearchPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12">
      <BlogResearcher />
    </main>
  )
}
```

### Bước 6 — Chạy và test

```bash
npm run dev
```

Mở `http://localhost:3000/research`, nhập niche hoặc URL, nhấn Phân tích.

---

## Hướng dẫn dùng

### Input dạng text (niche/brand)
- Nhập keyword mô tả niche: `best wireless earbuds`, `smart home devices`, `coffee maker reviews`
- Tool tự tạo seed keywords → tìm top 20 Google results → extract competitor domains → crawl blog của họ

### Input dạng URL
- Nhập URL website: `https://competitor.com` hoặc `https://yoursite.com`
- Tool phân tích domain đó + tìm thêm competitor cùng niche

### Output
Mỗi blog type hiển thị:
- **Pattern name**: tên dạng bài (`Best [Product] Under $[Price]`)
- **SEO Score**: 1–10, càng cao càng tiềm năng
- **Difficulty**: easy / medium / hard
- **Title mẫu**: 3 title sẵn sàng dùng
- **Cấu trúc Heading**: H1 + 6–7 H2 gợi ý
- **Content Tips**: lời khuyên cụ thể cho dạng bài này
- **SEO Notes**: kỹ thuật SEO đặc thù
- **Evidence URLs**: link bài thực từ competitor

### Export
- **Export CSV**: mở bằng Excel/Sheets, dùng để lập kế hoạch nội dung
- **Export JSON**: dữ liệu đầy đủ để tích hợp vào pipeline khác (Affpilot, Notion, v.v.)

---

## Thời gian chạy thực tế

| Bước | Thời gian ước tính |
|------|-------------------|
| Agent 1: Discovery | 15–30 giây |
| Agent 2: Crawl 50–100 bài | 2–4 phút |
| Agent 3: Gemini phân tích | 20–40 giây |
| Agent 4: Gemini tạo report | 15–30 giây |
| **Tổng** | **~3–5 phút** |

---

## Giới hạn và lưu ý

### Gemini free tier
- 15 requests/phút, 1 triệu tokens/ngày
- Nếu chạy nhiều jobs cùng lúc có thể bị rate limit → tool tự retry sau 4 giây
- Nếu cần scale, upgrade lên Gemini API paid plan (~$0.075/1M tokens cho Flash)

### SerpAPI
- Free tier: 100 searches/tháng
- Mỗi lần chạy tool dùng khoảng 3–5 searches
- Nếu cần nhiều hơn, upgrade plan hoặc dùng Google Custom Search API (100 queries/ngày miễn phí)

### In-memory job store
- Hiện tại jobs lưu trong RAM → **restart server = mất jobs đang chạy**
- Đủ dùng cho development và single-user production
- Nếu cần production ổn định hơn, xem phần Scale bên dưới

### Một số site block crawler
- Agent 2 dùng `fetch` thuần, không chạy JavaScript
- Các site dùng React/Vue/Next.js render phía client có thể trả về HTML rỗng
- Với những site này, cần Playwright (xem phần Playwright bên dưới)

---

## Playwright (tuỳ chọn — cho JS-rendered sites)

Nếu nhiều bài bị crawl ra rỗng, cài Playwright:

```bash
npm install playwright
npx playwright install chromium
```

Sau đó trong `agent2-crawler.ts`, tìm phần `NOTE: Playwright Option` ở cuối file và làm theo hướng dẫn.

> **Vercel users:** Playwright không chạy được trên Vercel Serverless. Cần tách crawler thành service riêng trên Railway hoặc Render, sau đó gọi qua API nội bộ.

---

## Deploy

### Vercel (không dùng Playwright)

```bash
# Thêm env vars trong Vercel dashboard
SERPAPI_KEY=...
GEMINI_API_KEY=...
```

Lưu ý: Vercel Hobby có timeout 10 giây cho serverless functions. Cần nâng lên **Vercel Pro** để dùng `maxDuration = 300` trong SSE route, hoặc tách sang service riêng.

### Self-hosted / VPS (khuyên dùng)

```bash
npm run build
npm start
# Hoặc dùng PM2:
pm2 start npm --name "blog-researcher" -- start
```

Không có giới hạn timeout, Playwright hoạt động bình thường.

---

## Scale lên production (tuỳ chọn)

Khi cần nhiều user chạy đồng thời, thay `job-store.ts` bằng BullMQ + Redis:

```bash
npm install bullmq ioredis
```

Thêm vào `.env.local`:
```env
REDIS_URL=redis://localhost:6379
```

Cấu trúc cơ bản:
```typescript
// lib/queue.ts
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis(process.env.REDIS_URL!)
export const researchQueue = new Queue('research', { connection })

// Worker chạy riêng (worker.ts)
new Worker('research', async (job) => {
  await runResearchJob(job.id!, job.data.input, (progress) => {
    job.updateProgress(progress)
  })
}, { connection })
```

---

## Troubleshooting

**Lỗi: `SERPAPI_KEY is not set`**
→ Kiểm tra file `.env.local` có đúng key không. Restart dev server sau khi sửa env.

**Lỗi: `Gemini API error 429`**
→ Vượt rate limit. Tool tự retry sau 4s. Nếu vẫn lỗi, đợi 1 phút rồi thử lại.

**Lỗi: `Chỉ crawl được X bài. Không đủ dữ liệu`**
→ Nhiều site block crawler. Thử input khác hoặc cài Playwright.

**Lỗi: `Cannot find module '@/types'`**
→ Kiểm tra `tsconfig.json` có `"@/*": ["./src/*"]` trong `paths`.

**SSE không nhận được data**
→ Kiểm tra không có reverse proxy (Nginx) buffer response. Thêm header `X-Accel-Buffering: no` (đã có trong code).

**Job pending mãi không chạy**
→ Có thể do server restart. Nhấn "Research mới" và thử lại.
