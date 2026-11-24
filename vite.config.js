import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Every external API is routed through the local Vite server so the browser
// never runs into CORS restrictions (SerpAPI and some LLM providers block
// direct browser calls). API keys are supplied by the user in the UI and are
// forwarded as-is; nothing is stored server-side.
const target = (url) => ({
  target: url,
  changeOrigin: true,
  secure: true,
  rewrite: (p) => p.replace(/^\/api\/[^/]+/, ''),
  // Turn network failures into a readable JSON error instead of an empty 500.
  configure: (proxy) => {
    proxy.on('error', (err, _req, res) => {
      if (res.headersSent) return;
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `Proxy could not reach ${url}: ${err.code || err.message}` } }));
    });
  },
});

const proxy = {
  '/api/serp': target('https://serpapi.com'),
  '/api/anthropic': target('https://api.anthropic.com'),
  '/api/openai': target('https://api.openai.com'),
  '/api/gemini': target('https://generativelanguage.googleapis.com'),
  '/api/xai': target('https://api.x.ai'),
};

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
