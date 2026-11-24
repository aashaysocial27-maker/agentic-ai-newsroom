# Agentic AI Newsroom

A three-agent content team, built with Vite + React, that turns the latest AI news into LinkedIn posts and X/Twitter threads for supply chain and procurement audiences.

```
 ┌────────────────┐   10 ideas   ┌──────────────┐  top 3 approved  ┌─────────────────┐
 │ Research Agent │ ───────────▶ │ Human review │ ───────────────▶ │ LinkedIn Agent  │─┐ run in
 │ SerpAPI + LLM  │ ◀─ feedback ─│ pick 3 + notes│                 │ X/Twitter Agent │─┘ parallel
 └────────────────┘              └──────────────┘                  └─────────────────┘
```

1. **Research Agent**: finds the latest AI news from the past 24 hours, 7 days or 30 days, with an optional focus, and pitches 10 ranked ideas, each with sources. You can send feedback and regenerate.
2. **You as editor**: pick exactly 3 ideas and approve them.
3. **Brief the writers**: optionally add notes for each story, a **LinkedIn CTA link** (globally or per post; if blank, posts have no link), and the **number of tweets per thread** (globally or per story).
4. **Twitter/X and LinkedIn agents run at the same time.** Review the results in tabs, one per story. Every tweet and post can be edited, copied or regenerated, and you can export everything as `.md`.

## Models and when you need SerpAPI

Choose one model for all three agents, or turn on **Different model per agent**. You can also enter a custom model ID.

Most models can **search the web on their own**. When the Research Agent's model can, **SerpAPI is optional**, and the sidebar labels the SerpAPI key *Optional* or *Required*.

| Provider | Models in the picker | Built-in search used |
|---|---|---|
| Anthropic | Claude Opus 5.5, Sonnet 5.5, Haiku 5.5 | Claude web search tool |
| OpenAI | GPT-5, GPT-5 mini, GPT-4.1, GPT-4o · *GPT-4.1 nano: none* | `web_search` tool (Responses API) |
| Google | Gemini 2.5 Pro, Flash, Flash-Lite | Grounding with Google Search |
| xAI | Grok 4 · *Grok 3 / 3 mini: none* | `web_search` tool (Responses API) |

If a model has no built-in search, the research step uses SerpAPI (Google News), and the SerpAPI key is required. You can also choose **Search source → SerpAPI** for any model.

Note: Anthropic organizations may need to enable web search in the Claude Console before Claude can use it.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

In the sidebar, choose a model and add its API key. Add a SerpAPI key only if the sidebar marks it *Required*. Keys are kept in memory unless you tick "Remember keys on this device".

API calls go through the Vite dev/preview server proxy (`vite.config.js`), because SerpAPI and some LLM APIs block direct browser requests. For a production-like run, use `npm run build && npm run preview`. The proxy forwards your keys to the provider and stores nothing.

## Layout

```
src/
  agents/research.js   Research Agent (SerpAPI + LLM → 10 ideas)
  agents/linkedin.js   LinkedIn Agent (audience prompt, CTA handling)
  agents/twitter.js    X Agent (N-tweet threads, 280-char enforcement)
  lib/models.js        Model catalog + which models have built-in web search
  lib/llm.js           Unified client for Anthropic / OpenAI / Gemini / xAI (+ hosted web search)
  lib/serp.js          SerpAPI news search + de-duplication
  components/          Sidebar, pipeline diagram, thread + LinkedIn previews
  App.jsx              Workflow (research → approve → brief → parallel writers)
```
