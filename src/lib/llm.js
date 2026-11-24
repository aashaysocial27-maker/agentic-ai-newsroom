// Unified client for the four supported LLM providers.
// All calls go through the Vite proxy (see vite.config.js) to avoid CORS issues.

export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-5-5',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    keyHint: 'sk-ant-...',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-5',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o'],
    keyHint: 'sk-...',
  },
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-pro',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    keyHint: 'AIza...',
  },
  xai: {
    label: 'xAI (Grok)',
    defaultModel: 'grok-4',
    models: ['grok-4', 'grok-3', 'grok-3-mini'],
    keyHint: 'xai-...',
  },
};

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

async function callAnthropic({ apiKey, model, system, prompt, maxTokens }) {
  const res = await fetch('/api/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${await readError(res)}`);
  const data = await res.json();
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// OpenAI and xAI share the Chat Completions format.
async function callChatCompletions(base, name, { apiKey, model, system, prompt }) {
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${name} ${await readError(res)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini({ apiKey, model, system, prompt, json, maxTokens }) {
  const res = await fetch(
    `/api/gemini/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${await readError(res)}`);
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text || '').join('');
}

/**
 * Send one prompt to the chosen provider and return the text reply.
 * @param {{provider:string, model:string, apiKey:string}} cfg
 */
export async function callLLM(cfg, { system, prompt, json = false, maxTokens = 8000 }) {
  const { provider, model, apiKey } = cfg;
  if (!apiKey) throw new Error(`No API key set for ${PROVIDERS[provider]?.label || provider}. Add it in Settings.`);
  const args = { apiKey, model, system, prompt, json, maxTokens };
  switch (provider) {
    case 'anthropic':
      return callAnthropic(args);
    case 'openai':
      return callChatCompletions('/api/openai', 'OpenAI', args);
    case 'xai':
      return callChatCompletions('/api/xai', 'xAI', args);
    case 'gemini':
      return callGemini(args);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
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

/** callLLM + parseJSON, with one automatic retry if the JSON is malformed. */
export async function callLLMJson(cfg, opts) {
  const text = await callLLM(cfg, { ...opts, json: true });
  try {
    return parseJSON(text);
  } catch {
    const retry = await callLLM(cfg, {
      ...opts,
      json: true,
      prompt: `${opts.prompt}\n\nIMPORTANT: Reply with ONLY valid JSON. No prose, no markdown fences.`,
    });
    return parseJSON(retry);
  }
}
