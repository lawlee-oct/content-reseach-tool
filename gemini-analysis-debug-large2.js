const articles = Array.from({ length: 25 }, (_, idx) => ({
  title: `Sample Article ${idx + 1} - Best earbuds ${idx + 1}`,
  h1: `Sample H1 ${idx + 1}`,
  h2s: ['Intro', 'Top Picks', 'Why Choose', 'FAQ'],
  wordCount: 1800 + idx * 20,
  url: `https://example.com/article-${idx + 1}`,
  structureHints: idx % 3 === 0 ? ['best-list'] : idx % 3 === 1 ? ['how-to'] : ['comparison'],
  domain: 'example.com',
}));
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
  return [
    'You are an expert SEO content strategist. Analyze these ' + articles.length + ' blog articles and identify recurring content patterns.',
    '',
    'ARTICLES:',
    JSON.stringify(articleData, null, 0),
    '',
    'TASK:',
    'Cluster these articles into 15-20 distinct blog post types/patterns. For each pattern:',
    '1. Give it a clear name with placeholders (e.g., "Best [Product] Under $[Price]", "How to [Action] Without [Pain Point]")',
    '2. Count how many articles match it',
    '3. Score its SEO potential (1-10)',
    '4. Note the typical H2 structure',
    '5. List up to 3 example URLs from the data',
    '',
    'IMPORTANT: Respond ONLY with valid JSON, no markdown, no explanation. Use this exact structure:',
    '{',
    '  "patterns": [',
    '    {',
    '      "id": "pattern-1",',
    '      "name": "Best [Product] Under $[Price]",',
    '      "titleTemplate": "Best {product} Under ${price} in {year}",',
    '      "frequency": 12,',
    '      "frequencyPct": 24,',
    '      "seoScore": 8,',
    '      "avgWordCount": 2200,',
    '      "dominantH2Pattern": "Quick Picks → Detailed Reviews → Buying Guide → FAQ",',
    '      "exampleUrls": ["https://..."],',
    '      "exampleTitles": ["Best Wireless Earbuds Under $100 in 2025"],',
    '      "structureHints": ["best-list", "review"]',
    '    }',
    '  ],',
    '  "topDomains": [',
    '    { "domain": "example.com", "articleCount": 15 }',
    '  ],',
    '  "analysisNotes": "Brief observation about the content landscape"',
    '}',
  ].join('\n');
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
