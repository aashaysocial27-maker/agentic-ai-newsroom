// Unified client for the four supported LLM providers.
// All calls go through the Vite proxy (see vite.config.js) to avoid CORS issues.
// With `webSearch: true` the provider's own hosted search tool is enabled and
// the reply also carries the cited URLs.

import { PROVIDERS } from './models.js';

async function readError(res) {
  let body = '';
  try {
    body = await res.text();
    const j = JSON.parse(body);
    body = j.error?.message || j.message || body;
  } catch {
    /* keep raw text */
  }
  return `${res.status} ${res.statusText}: ${String(body).slice(0, 400)}`;
}

async function post(url, headers, body, name) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name} ${await readError(res)}`);
  return res.json();
}

// ---------------- Anthropic ----------------
async function callAnthropic({ apiKey, model, system, prompt, maxTokens, webSearch }) {
  const headers = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  const messages = [{ role: 'user', content: prompt }];
  const body = { model, max_tokens: maxTokens, system, messages };
  if (webSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }];

  const citations = [];
  let text = '';
  // Server-side tool loops may pause; resume up to a few times.
  for (let turn = 0; turn < 4; turn++) {
    const data = await post('/api/anthropic/v1/messages', headers, body, 'Anthropic');
    for (const block of data.content || []) {
      if (block.type === 'text') text += block.text;
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) if (r.url) citations.push({ title: r.title, url: r.url, date: r.page_age });
      }
    }
    if (data.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: data.content });
    text = '';
  }
  return { text, citations };
}

// ---------------- OpenAI / xAI ----------------
// Plain generation uses Chat Completions; web search uses the Responses API,
// which both OpenAI and xAI expose with a `web_search` tool.
async function callChatCompletions(base, name, { apiKey, model, system, prompt }) {
  const data = await post(
    `${base}/v1/chat/completions`,
    { authorization: `Bearer ${apiKey}` },
    { model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] },
    name
  );
  return { text: data.choices?.[0]?.message?.content ?? '', citations: [] };
}

async function callResponses(base, name, { apiKey, model, system, prompt }) {
  const data = await post(
    `${base}/v1/responses`,
    { authorization: `Bearer ${apiKey}` },
    { model, instructions: system, input: prompt, tools: [{ type: 'web_search' }] },
    name
  );
  let text = typeof data.output_text === 'string' ? data.output_text : '';
  const citations = [];
  for (const item of data.output || []) {
    if (item.type !== 'message') continue;
    for (const c of item.content || []) {
      if (c.type === 'output_text') {
        if (!data.output_text) text += c.text;
        for (const a of c.annotations || []) if (a.url) citations.push({ title: a.title, url: a.url });
      }
    }
  }
  for (const c of data.citations || []) {
    const url = typeof c === 'string' ? c : c.url;
    if (url) citations.push({ title: c.title, url });
  }
  return { text, citations };
}

// ---------------- Gemini ----------------
async function callGemini({ apiKey, model, system, prompt, json, maxTokens, webSearch }) {
  const generationConfig = { maxOutputTokens: maxTokens };
  // JSON mode can't be combined with the Google Search tool; we parse JSON from text instead.
  if (json && !webSearch) generationConfig.responseMimeType = 'application/json';
  const data = await post(
    `/api/gemini/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': apiKey },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
      ...(webSearch ? { tools: [{ google_search: {} }] } : {}),
    },
    'Gemini'
  );
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
  const citations = (cand?.groundingMetadata?.groundingChunks || [])
    .map((c) => c.web)
    .filter(Boolean)
    .map((w) => ({ title: w.title, url: w.uri }));
  return { text, citations };
}

/**
 * Send one prompt to the chosen provider.
 * @returns {Promise<{text:string, citations:{title?:string,url:string}[]}>}
 */
export async function callLLMRaw(cfg, { system, prompt, json = false, maxTokens = 8000, webSearch = false }) {
  const { provider, model, apiKey } = cfg;
  if (!apiKey) throw new Error(`No API key for ${PROVIDERS[provider]?.label || provider}. Add it in the sidebar.`);
  const args = { apiKey, model, system, prompt, json, maxTokens, webSearch };
  switch (provider) {
    case 'anthropic':
      return callAnthropic(args);
    case 'openai':
      return webSearch ? callResponses('/api/openai', 'OpenAI', args) : callChatCompletions('/api/openai', 'OpenAI', args);
    case 'xai':
      return webSearch ? callResponses('/api/xai', 'xAI', args) : callChatCompletions('/api/xai', 'xAI', args);
    case 'gemini':
      return callGemini(args);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export async function callLLM(cfg, opts) {
  return (await callLLMRaw(cfg, opts)).text;
}

/** Pull a JSON value out of a model reply (handles ```json fences and stray prose). */
export function parseJSON(text) {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.search(/[[{]/);
    const open = cleaned[start];
    const end = cleaned.lastIndexOf(open === '[' ? ']' : '}');
    if (start === -1 || end <= start) throw new Error('Model did not return valid JSON.');
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

/**
 * callLLMRaw + parseJSON, with one retry if the JSON is malformed.
 * The retry never re-runs web search: it only asks the model to reformat.
 * @returns {Promise<{data:any, citations:object[]}>}
 */
export async function callLLMJsonRaw(cfg, opts) {
  const first = await callLLMRaw(cfg, { ...opts, json: true });
  try {
    return { data: parseJSON(first.text), citations: first.citations };
  } catch {
    const retry = await callLLMRaw(cfg, {
      system: 'You convert text into valid JSON. Reply with ONLY JSON, no prose, no markdown fences.',
      prompt: `Original instructions:\n${opts.prompt}\n\nDraft answer to convert into the required JSON shape:\n${first.text}`,
      json: true,
    });
    return { data: parseJSON(retry.text), citations: first.citations };
  }
}

export async function callLLMJson(cfg, opts) {
  return (await callLLMJsonRaw(cfg, opts)).data;
}
