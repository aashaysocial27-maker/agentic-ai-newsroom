import { callLLMJson } from '../lib/llm.js';
import { gatherNews } from '../lib/serp.js';

export const DEFAULT_QUERIES = [
  'agentic AI',
  'AI agents enterprise launch',
  'OpenAI Anthropic Google Gemini announcement',
  'AI supply chain',
  'AI procurement',
  'generative AI logistics',
];

const SYSTEM = `You are the Research Agent in a content newsroom.
You turn raw AI news into content ideas for a creator whose audiences are:
- LinkedIn: supply chain and procurement professionals with 7+ years of experience. Technical and data-literate, but often new to agentic AI.
- X/Twitter: procurement experts working at companies of all sizes.
You favour ideas with a concrete, practical angle for sourcing, purchasing, supplier management, planning, inventory and logistics.
You never invent facts: every idea must be grounded in the supplied articles.`;

function formatArticles(articles) {
  return articles
    .map(
      (a, i) =>
        `[${i + 1}] ${a.title}\nSource: ${a.source || 'unknown'} | ${a.date || ''}\nURL: ${a.link}\n${a.snippet || ''}`
    )
    .join('\n\n');
}

/**
 * Search the web for the latest AI news and propose 10 content ideas.
 * @param {object} p
 * @param {object} p.llm        {provider, model, apiKey}
 * @param {string} p.serpKey    SerpAPI key
 * @param {string[]} p.queries  search queries
 * @param {string} p.recency    'day' | 'week' | 'month'
 * @param {string} [p.feedback] optional human feedback to steer a re-run
 * @param {object[]} [p.previous] previous ideas (used together with feedback)
 * @param {object[]} [p.articles] reuse already-fetched articles instead of searching again
 * @param {(msg:string)=>void} [p.onStatus]
 */
export async function runResearchAgent({
  llm,
  serpKey,
  queries,
  recency,
  feedback,
  previous,
  articles,
  onStatus = () => {},
}) {
  let news = articles;
  if (!news?.length) {
    onStatus(`Searching the web (${queries.length} queries)…`);
    news = await gatherNews(serpKey, queries, recency);
  }
  if (!news.length) throw new Error('No news articles found. Try broader queries or a longer time window.');
  const corpus = news.slice(0, 40);

  onStatus(`Analysing ${corpus.length} articles and drafting 10 ideas…`);

  const feedbackBlock = feedback?.trim()
    ? `\n\nHUMAN FEEDBACK ON THE PREVIOUS ROUND (apply it):\n${feedback.trim()}\n\nPrevious ideas for reference:\n${(previous || [])
        .map((p, i) => `${i + 1}. ${p.title}`)
        .join('\n')}`
    : '';

  const prompt = `Here are the latest AI news articles:\n\n${formatArticles(corpus)}${feedbackBlock}

Produce EXACTLY 10 distinct content ideas. Return JSON of this shape:
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
Rank ideas from strongest to weakest. Use only URLs from the articles above.`;

  const data = await callLLMJson(llm, { system: SYSTEM, prompt });
  const ideas = (Array.isArray(data) ? data : data.ideas || []).slice(0, 10).map((idea, i) => ({
    id: `idea-${Date.now()}-${i}`,
    ...idea,
    sources: Array.isArray(idea.sources) ? idea.sources : [],
  }));
  if (!ideas.length) throw new Error('The Research Agent returned no ideas. Try again or switch model.');
  return { ideas, articles: news };
}
