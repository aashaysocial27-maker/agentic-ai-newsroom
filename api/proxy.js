// Vercel serverless function that forwards the app's API calls to the LLM
// providers and SerpAPI, replacing the Vite dev proxy in production.
//
// vercel.json rewrites /api/<provider>/<path> → /api/proxy?__provider=<provider>&__path=<path>.
// Only the exact endpoints the app uses are allowed, so this cannot be used as
// an open proxy. Users' API keys pass through in headers/query and are never stored or logged.

const UPSTREAMS = {
  serp: { base: 'https://serpapi.com', paths: [/^search\.json$/], methods: ['GET'] },
  anthropic: { base: 'https://api.anthropic.com', paths: [/^v1\/messages$/], methods: ['POST'] },
  openai: { base: 'https://api.openai.com', paths: [/^v1\/chat\/completions$/, /^v1\/responses$/], methods: ['POST'] },
  xai: { base: 'https://api.x.ai', paths: [/^v1\/chat\/completions$/, /^v1\/responses$/], methods: ['POST'] },
  gemini: {
    base: 'https://generativelanguage.googleapis.com',
    paths: [/^v1beta\/models\/[\w.\-]+:generateContent$/],
    methods: ['POST'],
  },
};

const FORWARD_HEADERS = ['content-type', 'authorization', 'x-api-key', 'anthropic-version', 'anthropic-beta', 'x-goog-api-key'];

function fail(res, status, message) {
  res.status(status).json({ error: { message } });
}

/** Work out provider + upstream path from the rewrite query, falling back to the raw URL. */
function resolveTarget(req) {
  let provider = req.query.__provider;
  let path = req.query.__path;
  if (Array.isArray(path)) path = path.join('/');
  if (!provider || !path) {
    const m = (req.url || '').split('?')[0].match(/^\/api\/([^/]+)\/(.+)$/);
    if (m) {
      provider = m[1];
      path = decodeURIComponent(m[2]);
    }
  }
  return { provider, path: (path || '').replace(/^\/+/, '') };
}

export default async function handler(req, res) {
  const { provider, path } = resolveTarget(req);
  const up = UPSTREAMS[provider];
  if (!up) return fail(res, 404, `Unknown API "${provider}".`);
  if (!up.paths.some((re) => re.test(path))) return fail(res, 404, `Endpoint not allowed: ${provider}/${path}`);
  if (!up.methods.includes(req.method)) return fail(res, 405, `Method ${req.method} not allowed.`);

  // Pass through the caller's query string (e.g. SerpAPI params), minus our routing params.
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k === '__provider' || k === '__path') continue;
    for (const val of Array.isArray(v) ? v : [v]) query.append(k, val);
  }
  const qs = query.toString();
  const url = `${up.base}/${path}${qs ? `?${qs}` : ''}`;

  const headers = {};
  for (const h of FORWARD_HEADERS) if (req.headers[h]) headers[h] = req.headers[h];

  let body;
  if (req.method === 'POST') {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    headers['content-type'] = headers['content-type'] || 'application/json';
  }

  try {
    const upstream = await fetch(url, { method: req.method, headers, body });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.send(text);
  } catch (err) {
    fail(res, 502, `Could not reach ${up.base}: ${err.message}`);
  }
}
