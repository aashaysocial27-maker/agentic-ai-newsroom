import { callLLMJson } from '../lib/llm.js';

const MAX_CHARS = 280;

const SYSTEM = `You are the X (Twitter) Agent. You write threads for procurement experts working at
companies of every size (category managers, sourcing leads, CPOs, buyers).

How you write:
- Tweet 1 is the hook: a bold, specific claim or question tied to the news. It must make a procurement pro stop scrolling.
- Each tweet carries ONE idea and stands on its own. Short sentences. Concrete examples from sourcing, supplier risk,
  contract management, spend analysis, PO automation, negotiations.
- Explain AI jargon in plain words. No hype, no hashtag spam (max 1 hashtag in the whole thread, only if natural).
- Number tweets like "1/", "2/" at the start.
- Final tweet: a crisp takeaway plus an invitation to reply or follow for more.
- HARD LIMIT: every tweet must be at most ${MAX_CHARS} characters INCLUDING the number prefix.
- Never invent facts, numbers or quotes beyond the provided idea and sources.`;

/**
 * Write one X/Twitter thread for an idea.
 * @param {object} p
 * @param {object} p.llm         {provider, model, apiKey}
 * @param {object} p.idea        idea object from the Research Agent
 * @param {number} p.tweetCount  number of tweets in the thread
 * @param {string} [p.notes]     optional human notes / feedback for this thread
 */
export async function runTwitterAgent({ llm, idea, tweetCount, notes }) {
  const n = Math.max(1, Math.min(25, Number(tweetCount) || 5));

  const prompt = `Write an X/Twitter thread of EXACTLY ${n} tweet${n > 1 ? 's' : ''} for this idea.

Title: ${idea.title}
What happened: ${idea.summary || ''}
Angle for procurement: ${idea.angle || ''}
Why now: ${idea.whyNow || ''}
Suggested hook: ${idea.hook || ''}
Sources: ${(idea.sources || []).map((s) => `${s.title || ''} ${s.url || ''}`).join(' | ')}
${notes?.trim() ? `\nHuman editor notes (follow these): ${notes.trim()}` : ''}

Return JSON: {"tweets": ["1/ ...", "2/ ...", ...]}  (exactly ${n} items, each ≤ ${MAX_CHARS} chars)`;

  const data = await callLLMJson(llm, { system: SYSTEM, prompt });
  let tweets = (Array.isArray(data) ? data : data.tweets || []).map((t) => String(t).trim()).filter(Boolean);
  if (!tweets.length) throw new Error('X Agent returned an empty thread.');

  // Ask once for a fix if any tweet is too long or the count is off.
  const tooLong = tweets.some((t) => t.length > MAX_CHARS);
  if (tooLong || tweets.length !== n) {
    const fix = await callLLMJson(llm, {
      system: SYSTEM,
      prompt: `Fix this thread so it has EXACTLY ${n} tweets and every tweet is ≤ ${MAX_CHARS} characters (including the "k/" prefix). Keep the meaning and voice.

${JSON.stringify({ tweets })}

Return JSON: {"tweets": [...]}`,
    });
    const fixed = (fix.tweets || []).map((t) => String(t).trim()).filter(Boolean);
    if (fixed.length) tweets = fixed;
  }

  return { tweets, maxChars: MAX_CHARS };
}
