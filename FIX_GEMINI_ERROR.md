# 🔧 Fix: Gemini API Unavailable Error

## Problem
Flow stuck at **Agent 3 (Pattern Analyzer)** with message:
```
Fallback analysis based on structural hints (Gemini unavailable)
```

## Root Cause
`GEMINI_API_KEY` environment variable is not set or invalid.

Flow breakdown:
1. ✅ Agent 1 (Discovery) - works fine
2. ✅ Agent 2 (Crawler) - works fine  
3. ❌ Agent 3 (Analyzer) - **STUCK**: Tries Gemini API → 400 error (invalid key)
4. ❌ Agent 4 (Report) - Fails due to Agent 3 fallback

## Solution

### Option 1: Use Google Gemini (Recommended - Free)

**Step 1: Get API Key**
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

**Step 2: Set Environment Variable**

Update `.env.local` with your key:
```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

**Step 3: Restart Dev Server**
```bash
npm run dev
```

### Option 2: Use OpenAI as Fallback

**Step 1: Get API Key**
- Go to https://platform.openai.com/api-keys
- Create new secret key

**Step 2: Set in .env.local**
```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

### Option 3: Use Both (Recommended)

Most reliable setup:
```bash
# Primary: Google Gemini (free tier)
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash

# Fallback: OpenAI (in case Gemini fails)
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini

# For Agent 1 (Discovery)
SERPAPI_KEY=your_serpapi_key
```

## Testing

**After setting keys:**
```bash
# Rebuild/restart
npm run dev

# Test the flow
curl -X POST http://localhost:3000/api/research/run-pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "inputText": "best wireless earbuds",
    "maxUrls": 10
  }'
```

## API Cost Overview

| Provider | Cost | Free Tier |
|----------|------|-----------|
| **Gemini** | ~$0.075/M input tokens | 15 req/min, 1M tokens/day |
| **OpenAI GPT-4o mini** | ~$0.15/M input tokens | ❌ No free tier |
| **SerpAPI** | Paid only | ❌ No free tier |

## Debugging Output

Once fixed, you should see:
```
📡 Using Gemini API
📡 Agent 3 trying Gemini model: gemini-2.5-flash
✅ Analyzing 25 articles để tìm patterns...
📡 Generating detailed report cho 18 blog types...
✅ Report hoàn tất: 18 blog types
```

## If Still Failing

Check logs for exact error:
```bash
# See what's happening
npm run dev 2>&1 | grep -i "gemini\|error\|failed"
```

Common errors:
- ❌ `API key not valid` → Key is wrong/expired
- ❌ `INVALID_ARGUMENT` → Missing GEMINI_API_KEY
- ❌ `429 Too Many Requests` → Hit rate limit (wait 60 sec)

## Environment Variables Reference

**Required for full flow:**
```bash
# LLM (at least one)
GEMINI_API_KEY=...         # Google Gemini
OPENAI_API_KEY=...         # OpenAI (fallback)

# For Agent 1 (Competitor Discovery)
SERPAPI_KEY=...            # Google Search results

# Optional
GEMINI_MODEL=gemini-2.5-flash    # Default model
OPENAI_MODEL=gpt-4o-mini         # Default model
```

## Next Steps

1. ✅ Create `.env.local` with API keys
2. ✅ Restart: `npm run dev`
3. ✅ Test: `npm run build && npm start`
4. ✅ Monitor logs for success messages

---
**Last Updated**: 2025-05-15
**Status**: Environment setup required
