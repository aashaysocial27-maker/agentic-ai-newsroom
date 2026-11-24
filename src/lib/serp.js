// SerpAPI news search (Google News results, filtered to a recent time window).

const RECENCY = { day: 'qdr:d', week: 'qdr:w', month: 'qdr:m' };

async function searchNews(apiKey, q, recency, num = 10) {
  const params = new URLSearchParams({
    engine: 'google',
    tbm: 'nws',
    q,
    num: String(num),
    tbs: RECENCY[recency] || RECENCY.week,
    hl: 'en',
    gl: 'us',
    api_key: apiKey,
  });
  const res = await fetch(`/api/serp/search.json?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`SerpAPI: ${data.error?.message || data.error || `${res.status} ${res.statusText}`}`);
  }
  return (data.news_results || []).map((r) => ({
    title: r.title,
    link: r.link,
    source: typeof r.source === 'object' ? r.source?.name : r.source,
    date: r.date,
    snippet: r.snippet,
    query: q,
  }));
}

/**
 * Run several news queries in parallel and return a de-duplicated article list.
 * Individual query failures are tolerated as long as at least one succeeds.
 */
export async function gatherNews(apiKey, queries, recency = 'week') {
  if (!apiKey) throw new Error('No SerpAPI key set. Add it in Settings.');
  const settled = await Promise.allSettled(queries.map((q) => searchNews(apiKey, q, recency)));
  const ok = settled.filter((s) => s.status === 'fulfilled');
  if (!ok.length) throw settled[0].reason;

  const seen = new Set();
  const articles = [];
  for (const s of ok) {
    for (const a of s.value) {
      const key = (a.link || a.title || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      articles.push(a);
    }
  }
  return articles;
}
