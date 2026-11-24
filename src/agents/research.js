import { callLLMJsonRaw } from '../lib/llm.js';
import { gatherNews } from '../lib/serp.js';

const BASE_QUERIES = [
  'agentic AI',
  'AI agents enterprise launch',
  'OpenAI Anthropic Google Gemini announcement',
  'AI supply chain',
  'AI procurement',
];

const WINDOW_LABEL = { day: 'past 24 hours', week: 'past 7 days', month: 'past 30 days' };

const SYSTEM = `You are the Research Agent in a content newsroom.
You turn raw AI news into content ideas for a creator whose audiences are:
- LinkedIn: supply chain and procurement professionals with 7+ years of experience. Technical and data-literate, but often new to agentic AI.
- X/Twitter: procurement experts working at companies of all sizes.
You favour ideas with a concrete, practical angle for sourcing, purchasing, supplier management, planning, inventory and logistics.
You never invent facts: every idea must be grounded in real, recent, verifiable news.`;

const IDEA_SCHEMA = `Return JSON of this shape:
{
  "ideas": [
    {
      "title": "short punchy working title",
      "summary": "2-3 sentences on what happened (the news)",
      "angle": "the specific take for supply chain / procurement professionals",
      "whyNow": "why this matters this week",
      "hook": "a scroll-stopping opening line",
      "audienceFit": 1-10,
      "sources": [{"title": "...", "url": "..."}]
    }
  ]
}
Rank ideas from strongest to weakest.`;

function focusTerms(focus) {
  return (focus || '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function feedbackBlock(feedback, previous) {
  if (!feedback?.trim()) return '';
  return `\n\nHUMAN FEEDBACK ON THE PREVIOUS ROUND (apply it):\n${feedback.trim()}\n\nPrevious ideas for reference:\n${(previous || [])
    .map((p, i) => `${i + 1}. ${p.title}`)
    .join('\n')}`;
}

function normalise(data) {
  const ideas = (Array.isArray(data) ? data : data.ideas || []).slice(0, 10).map((idea, i) => ({
    id: `idea-${Date.now()}-${i}`,
    ...idea,
    sources: Array.isArray(idea.sources) ? idea.sources.filter((s) => s && s.url) : [],
  }));
  if (!ideas.length) throw new Error('The Research Agent returned no ideas. Try again or switch model.');
  return ideas;
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((a) => {
    const k = (a.url || a.link || '').toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Find the latest AI news and propose 10 content ideas.
 * Uses the model's own web search when `searchSource === 'native'`, otherwise SerpAPI.
 * When re-running with feedback in SerpAPI mode, previously fetched articles are reused.
 *
 * @returns {Promise<{ideas:object[], articles:object[]}>}
 */
export async function runResearchAgent({
  llm,
  searchSource,
  serpKey,
  focus,
  recency,
  feedback,
  previous,
  articles,
  onStatus = () => {},
}) {
  const terms = focusTerms(focus);
  const window = WINDOW_LABEL[recency] || WINDOW_LABEL.week;

  // ---------- Built-in web search ----------
  if (searchSource === 'native') {
    onStatus('Searching the web with the model’s built-in search…');
    const prompt = `Search the web for the most important AI news from the ${window} (today is ${new Date().toDateString()}).
Cover: AI agents and agentic AI, major model/product launches, enterprise AI adoption, and anything touching supply chain, procurement, sourcing or logistics.${
      terms.length ? `\nGive extra weight to: ${terms.join(', ')}.` : ''
    }
Run several searches. Only use stories published in the ${window}.${feedbackBlock(feedback, previous)}

Then produce EXACTLY 10 distinct content ideas. ${IDEA_SCHEMA}
Every idea must cite the real article URLs you found.`;

    const { data, citations } = await callLLMJsonRaw(llm, { system: SYSTEM, prompt, webSearch: true, maxTokens: 12000 });
    const ideas = normalise(data);
    const found = dedupe([...citations, ...ideas.flatMap((i) => i.sources)]).map((c) => ({ title: c.title, link: c.url }));
    return { ideas, articles: found };
  }

  // ---------- SerpAPI ----------
  let news = articles;
  if (!news?.length) {
    const queries = [...BASE_QUERIES, ...terms, ...terms.map((t) => `${t} AI`)];
    onStatus(`Searching Google News via SerpAPI (${queries.length} queries)…`);
    news = await gatherNews(serpKey, queries, recency);
  }
  if (!news.length) throw new Error('No news articles found. Try a broader focus or a longer news window.');
  const corpus = news.slice(0, 40);

  onStatus(`Reading ${corpus.length} articles and drafting 10 ideas…`);
  const list = corpus
    .map((a, i) => `[${i + 1}] ${a.title}\nSource: ${a.source || 'unknown'} | ${a.date || ''}\nURL: ${a.link}\n${a.snippet || ''}`)
    .join('\n\n');

  const prompt = `Here are the latest AI news articles (${window}):\n\n${list}${
    terms.length ? `\n\nGive extra weight to: ${terms.join(', ')}.` : ''
  }${feedbackBlock(feedback, previous)}

Produce EXACTLY 10 distinct content ideas. ${IDEA_SCHEMA}
Use only URLs from the articles above.`;

  const { data } = await callLLMJsonRaw(llm, { system: SYSTEM, prompt });
  return { ideas: normalise(data), articles: news };
}
