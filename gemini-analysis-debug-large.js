const articles = Array.from({ length: 25 }, (_, idx) => ({
  title: `Sample Article ${idx + 1} - Best earbuds ${idx + 1}`,
  h1: `Sample H1 ${idx + 1}`,
  h2s: ['Intro', 'Top Picks', 'Why Choose', 'FAQ'],
  wordCount: 1800 + (idx * 20),
  url: `https://example.com/article-${idx + 1}`,
  structureHints: idx % 3 === 0 ? ['best-list'] : idx % 3 === 1 ? ['how-to'] : ['comparison'],
  domain: 'example.com',
});
function buildAnalysisPrompt(articles) {
  const articleData = articles.map((a, i) => ({
    i: i + 1,
    title: a.title,
    h1: a.h1,
    h2s: a.h2s.slice(0, 6),
    wc: a.wordCount,
    url: a.url,
    hints: a.structureHints,
  }));
  return `You are an expert SEO content strategist. Analyze these ${articles.length} blog articles and identify recurring content patterns.\n\nARTICLES:\n${JSON.stringify(articleData, null, 0)}\n\nTASK:\nCluster these articles into 15-20 distinct blog post types/patterns. For each pattern:\n1. Give it a clear name with placeholders (e.g., "Best [Product] Under $[Price]", "How to [Action] Without [Pain Point]")\n2. Count how many articles match it\n3. Score its SEO potential (1-10)\n4. Note the typical H2 structure\n5. List up to 3 example URLs from the data\n\nIMPORTANT: Respond ONLY with valid JSON, no markdown, no explanation. Use this exact structure:\n{\n  "patterns": [\n    {\n      "id": "pattern-1",\n      "name": "Best [Product] Under $[Price]",\n      "titleTemplate": "Best {product} Under \${price} in {year}",\n      "frequency": 12,\n      "frequencyPct": 24,\n      "seoScore": 8,\n      "avgWordCount": 2200,\n      "dominantH2Pattern": "Quick Picks → Detailed Reviews → Buying Guide → FAQ",\n      "exampleUrls": ["https://..."],\n      "exampleTitles": ["Best Wireless Earbuds Under $100 in 2025"],\n      "structureHints": ["best-list", "review"]\n    }\n  ],\n  "topDomains": [\n    { "domain": "example.com", "articleCount": 15 }\n  ],\n  "analysisNotes": "Brief observation about the content landscape"\n}\n`;
}
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: 'application/json' },
    }),
  });
  console.log('status', res.status);
  const raw = await res.text();
  console.log('raw length', raw.length);
  console.log('head:', raw.slice(0, 1000));
  return raw;
}
function parseAnalysisResponse(raw) {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    console.log('parsed OK keys:', Object.keys(parsed));
    return parsed;
  } catch (e) {
    console.error('parse failed:', e.message);
    console.error('cleaned head:', cleaned.slice(0, 2000));
    return null;
  }
}
(async () => {
  const prompt = buildAnalysisPrompt(articles);
  const raw = await callGemini(prompt);
  parseAnalysisResponse(raw);
})();
