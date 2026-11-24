import { callLLMJson } from '../lib/llm.js';

const SYSTEM = `You are the LinkedIn Agent. You write LinkedIn posts for a creator whose audience is
supply chain and procurement professionals with 7+ years of experience.

Who they are:
- Seasoned, technical, comfortable with ERP, S2P/P2P, MRP, S&OP, supplier scorecards, TCO, spend analytics.
- Many have NOT yet worked with agentic AI. They are curious but sceptical of hype.

How you write:
- Approachable and practical. Explain any AI term in one plain sentence using a supply chain analogy
  (e.g. "an AI agent is like a junior buyer who can follow a playbook, use your systems, and escalate when unsure").
- Lead with a hook in the first 2 lines (that's all LinkedIn shows before "…see more").
- Short paragraphs, generous line breaks, 150–300 words. Optional short bullet list using "→" or "•".
- Tie the news to a concrete procurement / supply chain use case, risk, or question to ask vendors.
- Confident, peer-to-peer tone. No hype words ("revolutionary", "game-changer"), no emoji walls (max 2 emoji).
- Plain text only: LinkedIn does not render markdown, so no **bold**, no # headings.
- End with a question that invites comments from practitioners, then 3–5 relevant hashtags.
- Never invent facts, numbers or quotes beyond the provided idea and sources.`;

/**
 * Write one LinkedIn post for an idea.
 * @param {object} p
 * @param {object} p.llm        {provider, model, apiKey}
 * @param {object} p.idea       idea object from the Research Agent
 * @param {string} [p.ctaLink]  optional URL to put in the call-to-action
 * @param {string} [p.ctaText]  optional CTA wording
 * @param {string} [p.notes]    optional human notes / feedback for this post
 */
export async function runLinkedInAgent({ llm, idea, ctaLink, ctaText, notes }) {
  const link = ctaLink?.trim();
  const ctaInstruction = link
    ? `Directly after the closing question and BEFORE the hashtags, add a call-to-action line that includes this exact link: ${link}
${ctaText?.trim() ? `Base the CTA wording on: "${ctaText.trim()}"` : 'Write a short, natural CTA (e.g. "Read the full breakdown here: <link>").'}`
    : 'Do not include any links or call-to-action URL.';

  const prompt = `Write a LinkedIn post for this idea.

Title: ${idea.title}
What happened: ${idea.summary || ''}
Angle for supply chain / procurement: ${idea.angle || ''}
Why now: ${idea.whyNow || ''}
Suggested hook: ${idea.hook || ''}
Sources: ${(idea.sources || []).map((s) => `${s.title || ''} ${s.url || ''}`).join(' | ')}
${notes?.trim() ? `\nHuman editor notes (follow these): ${notes.trim()}` : ''}

${ctaInstruction}

Return JSON: {"post": "the full post text with \\n line breaks", "hashtags": ["#..."]}`;

  const data = await callLLMJson(llm, { system: SYSTEM, prompt });
  let post = String(data.post || '').trim();
  if (!post) throw new Error('LinkedIn Agent returned an empty post.');

  // Guarantee the CTA link is present when the user supplied one.
  if (link && !post.includes(link)) {
    post += `\n\n👉 ${ctaText?.trim() || 'Learn more'}: ${link}`;
  }
  return { post, hashtags: data.hashtags || [] };
}
