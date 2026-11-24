# Agentic AI Newsroom

A three-agent content team, built with Vite + React, that turns the latest AI news into LinkedIn posts and X/Twitter threads for supply chain and procurement audiences.

```
 ┌────────────────┐   10 ideas   ┌──────────────┐  top 3 approved  ┌─────────────────┐
 │ Research Agent │ ───────────▶ │ Human review │ ───────────────▶ │ LinkedIn Agent  │─┐ run in
 │ SerpAPI + LLM  │ ◀─ feedback ─│ pick 3 + notes│                 │ X/Twitter Agent │─┘ parallel
 └────────────────┘              └──────────────┘                  └─────────────────┘
```

1. **Research Agent**: runs your search queries through SerpAPI (Google News, past day/week/month), then asks the LLM for 10 ranked content ideas, each with its sources. You can send feedback and regenerate.
2. **Human review**: pick exactly 3 ideas, add optional notes for each one, then approve.
3. **LinkedIn Agent**: writes plain-text, approachable posts for supply chain and procurement leaders with 7+ years of experience. If you enter a **CTA link** (globally or for one idea), it is added to every post. If you leave it blank, the post has no link.
4. **X/Twitter Agent**: writes numbered threads for procurement experts. You choose the **number of tweets** with a slider and can override it per idea. Each tweet is checked against the 280-character limit.

The LinkedIn and X agents run at the same time. Every output can be edited, copied or regenerated, and you can export everything as Markdown.

## Models

Each agent can use its own provider and model (Settings → Model per agent):

| Provider | Default model (editable) |
|---|---|
| Anthropic | `claude-sonnet-5-5` (also `claude-opus-5-5`, `claude-haiku-5-5`) |
| OpenAI | `gpt-5` |
| Google Gemini | `gemini-2.5-pro` |
| xAI Grok | `grok-4` |

You can type any model ID your account has access to.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

Open **⚙ Settings** and add your SerpAPI key plus the key for each LLM provider you use. Keys are kept in memory unless you tick "Remember keys on this device".

API calls go through the Vite dev/preview server proxy (`vite.config.js`), because SerpAPI and some LLM APIs block direct browser requests. For a production-like run, use `npm run build && npm run preview`. The proxy forwards your keys to the provider and stores nothing.

## Layout

```
src/
  agents/research.js   Research Agent (SerpAPI + LLM → 10 ideas)
  agents/linkedin.js   LinkedIn Agent (audience prompt, CTA handling)
  agents/twitter.js    X Agent (N-tweet threads, 280-char enforcement)
  lib/llm.js           Unified client for Anthropic / OpenAI / Gemini / xAI
  lib/serp.js          SerpAPI news search + de-duplication
  App.jsx              Workflow UI (research → review → parallel generation)
```
