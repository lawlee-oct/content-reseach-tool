# ContentScope — Công cụ research nội dung theo ngách

Ứng dụng **Next.js** chạy pipeline **niche / brand / URL → Tavily (search + extract) → đối thủ theo domain + profile social (SERP) → chấm điểm heuristic → tổng hợp cấu trúc `brands[]` (brand → kênh → topic + evidence URL + nguồn metric: snippet / suy luận)**. Có **OpenAI** (tùy chọn) để gộp chủ đề và viết góc nội dung trên cùng evidence.

**Không có dữ liệu demo trong code.** Nếu thiếu API key hoặc Tavily lỗi, API trả lỗi rõ ràng (HTTP + `code` + `error`).

---

## Yêu cầu

- **Node.js** (khuyến nghị LTS, tương thích Next 16)
- **Tài khoản Tavily** + API key ([tavily.com](https://www.tavily.com)) — **bắt buộc** cho discovery + extract
- **OpenAI API key** ([platform.openai.com](https://platform.openai.com)) — **tùy chọn**: bật bước LLM gộp `brand → kênh → topic`; không có key thì dùng nhóm heuristic trên cùng dữ liệu Tavily

---

## Cài đặt và chạy local

### 1. Cài dependency

```bash
npm install
```

### 2. Biến môi trường (bắt buộc)

Tạo file **`.env.local`** ở **thư mục gốc** của project (cùng cấp với `package.json`):

```env
TAVILY_API_KEY=tvly-xxxxxxxx
OPENAI_API_KEY=sk-...   # tùy chọn — khuyến nghị để báo cáo topic đọc tốt hơn
# OPENAI_MODEL=gpt-4o-mini
```

Bạn có thể copy từ file mẫu:

```bash
cp .env.example .env.local
```

Rồi điền key thật vào `.env.local`.

> **Lưu ý:** Không commit `.env.local` lên git (thường đã nằm trong `.gitignore`).

### 3. Chạy dev server

```bash
npm run dev
```

Mở trình duyệt: [http://localhost:3000](http://localhost:3000)

### 4. Build production (kiểm tra compile)

```bash
npm run build
npm start
```

---

## Cách hoạt động (flow A → Z)

1. **Client** (`ContentResearchTool`) gửi `POST /api/research` với `mode`, `value`, `platforms`, …
2. **Server** (`app/api/research/route.ts`) kiểm tra input và **`TAVILY_API_KEY`**.
3. **Pipeline** (`app/lib/research/pipeline.ts`):
   - **niche / brand:** Tavily **search** câu truy vấn discovery → gom kết quả theo **domain website** (bỏ URL mạng xã hội làm “gốc competitor”).
   - **url:** Tavily **extract** trang → lấy đoạn text → suy ra query discovery tiếp theo.
   - **Extract** batch các URL (homepage + vài trang từ kết quả search) để có snippet dài phục vụ scoring.
   - Với mỗi competitor, **search thêm** theo nền tảng đã chọn (Instagram, TikTok, …) để lấy **URL profile / bài** từ SERP (không scrape login wall).
   - **Scoring** (`scoring.ts`): overlap từ khóa với ngách + heuristic format — **không gọi LLM** mặc định.
4. Trả về **`ResearchResponse`**: `competitors` + `aggregate_*` (raw), và **`brands`** (đã cấu trúc brand → kênh → topic). Trường `summary.synthesis_method` là `llm` hoặc `heuristic`.

Giới hạn số lần gọi Tavily search mỗi request: xem `MAX_TAVILY_SEARCHES` trong `pipeline.ts` (tiết kiệm credit).

---

## API `POST /api/research`

**Body JSON (ví dụ):**

```json
{
  "mode": "niche",
  "value": "Home decor small space",
  "platforms": ["website", "instagram", "tiktok", "youtube"],
  "locale": "en-US",
  "max_competitors": 4
}
```

- `mode`: `"niche"` | `"brand"` | `"url"`
- `value`: text ngách / tên brand / **URL đầy đủ `http(s)`** khi `mode` là `url`
- `platforms`: danh sách kênh cần discovery + lọc kết quả UI

**Thành công (200):** body là `ResearchResponse` (job id, `summary`, `competitors`, `aggregate_top_content_for_niche`).

**Lỗi thường gặp:**

| HTTP | `code` (nếu có) | Ý nghĩa |
|------|-----------------|--------|
| 400 | `INVALID_JSON`, `INVALID_MODE`, … | Thiếu/sai tham số — xem trường `error` |
| 503 | `MISSING_TAVILY_API_KEY` | Chưa set `TAVILY_API_KEY` trên server |
| 502 | `RESEARCH_FAILED` | Tavily lỗi / không có kết quả / cluster rỗng — xem `error` |

---

## Cấu trúc thư mục (liên quan research)

| Đường dẫn | Vai trò |
|-----------|---------|
| `app/api/research/route.ts` | Route handler, validate, gọi pipeline |
| `app/lib/research/pipeline.ts` | Orchestration toàn flow |
| `app/lib/research/tavily.ts` | Client Tavily Search + Extract |
| `app/lib/research/discover.ts` | Cluster domain, pick URL theo platform |
| `app/lib/research/scoring.ts` | Điểm heuristic cho raw findings |
| `app/lib/research/llm-synthesis.ts` | Heuristic + OpenAI tổng hợp `brands` (URL neo evidence) |
| `app/lib/research/types.ts` | Type JSON request/response |
| `app/constants/platforms.ts` | Icon/label nền tảng cho UI |
| `app/components/ContentResearchTool.tsx` | Form + gọi API + hiển thị kết quả |
| `app/components/BrandInsightCard.tsx` | UI brand → kênh → topic |
| `app/components/CompetitorResultCard.tsx` | Card raw findings (trong phần gập) |

---

## Triển khai (Vercel / hosting)

1. Thêm biến môi trường **`TAVILY_API_KEY`** (bắt buộc) và tùy chọn **`OPENAI_API_KEY`** trong dashboard hosting.
2. Đảm bảo timeout đủ cho chuỗi request Tavily (route đặt `maxDuration = 60` giây — tuỳ plan).

---

## Lưu ý pháp lý & sản phẩm

- Tuân thủ **Điều khoản** từng nền tảng và **robots.txt**. Pipeline dùng **Tavily** (search + extract) trên URL công khai; không thay cho API chính thức nếu cần dữ liệu sâu.
- Kết quả discovery có thể **sai lệch**; dùng `summary.notes` và kiểm tra thủ công URL quan trọng.

---

## Script npm

| Lệnh | Mô tả |
|------|--------|
| `npm run dev` | Dev server |
| `npm run build` | Build production |
| `npm run start` | Chạy bản build |
| `npm run lint` | ESLint |
