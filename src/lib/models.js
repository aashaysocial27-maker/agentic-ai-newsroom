// Provider + model catalog.
// `webSearch` = the model can search the web on its own (provider-hosted tool),
// in which case SerpAPI is optional for the Research Agent.

export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    keyLabel: 'Anthropic API key',
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    searchTool: 'Claude web search tool',
  },
  openai: {
    label: 'OpenAI',
    keyLabel: 'OpenAI API key',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    searchTool: 'OpenAI web_search tool',
  },
  gemini: {
    label: 'Google Gemini',
    keyLabel: 'Gemini API key',
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
    searchTool: 'Grounding with Google Search',
  },
  xai: {
    label: 'xAI Grok',
    keyLabel: 'xAI API key',
    keyHint: 'xai-…',
    keyUrl: 'https://console.x.ai',
    searchTool: 'xAI web_search tool',
  },
};

export const SERP = {
  keyLabel: 'SerpAPI key',
  keyHint: 'SerpAPI key',
  keyUrl: 'https://serpapi.com/manage-api-key',
};

export const MODELS = [
  { id: 'claude-opus-5-5', provider: 'anthropic', label: 'Claude Opus 5.5', webSearch: true },
  { id: 'claude-sonnet-5-5', provider: 'anthropic', label: 'Claude Sonnet 5.5', webSearch: true },
  { id: 'claude-haiku-5-5', provider: 'anthropic', label: 'Claude Haiku 5.5', webSearch: true },

  { id: 'gpt-5', provider: 'openai', label: 'GPT-5', webSearch: true },
  { id: 'gpt-5-mini', provider: 'openai', label: 'GPT-5 mini', webSearch: true },
  { id: 'gpt-4.1', provider: 'openai', label: 'GPT-4.1', webSearch: true },
  { id: 'gpt-4o', provider: 'openai', label: 'GPT-4o', webSearch: true },
  { id: 'gpt-4.1-nano', provider: 'openai', label: 'GPT-4.1 nano', webSearch: false },

  { id: 'gemini-2.5-pro', provider: 'gemini', label: 'Gemini 2.5 Pro', webSearch: true },
  { id: 'gemini-2.5-flash', provider: 'gemini', label: 'Gemini 2.5 Flash', webSearch: true },
  { id: 'gemini-2.5-flash-lite', provider: 'gemini', label: 'Gemini 2.5 Flash-Lite', webSearch: true },

  { id: 'grok-4', provider: 'xai', label: 'Grok 4', webSearch: true },
  { id: 'grok-3', provider: 'xai', label: 'Grok 3', webSearch: false },
  { id: 'grok-3-mini', provider: 'xai', label: 'Grok 3 mini', webSearch: false },
];

export const DEFAULT_MODEL = { provider: 'anthropic', model: 'claude-sonnet-5-5' };

/** Returns catalog info for a {provider, model} choice, including custom model IDs. */
export function modelInfo({ provider, model }) {
  const known = MODELS.find((m) => m.id === model && m.provider === provider);
  if (known) return { ...known, custom: false };
  // Custom model ID: every supported provider offers hosted web search on its
  // current flagship models, so assume yes. The user can still force SerpAPI.
  return { id: model, provider, label: model, webSearch: true, custom: true };
}

/** Does the Research Agent need SerpAPI for this model + search preference? */
export function serpRequired(researchModel, searchSource) {
  return searchSource === 'serp' || !modelInfo(researchModel).webSearch;
}
