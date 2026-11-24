import { useEffect, useState } from 'react';
import Settings from './components/Settings.jsx';
import IdeaCard from './components/IdeaCard.jsx';
import { LinkedInCard, TwitterCard } from './components/Outputs.jsx';
import { PROVIDERS } from './lib/llm.js';
import { load, save, remove } from './lib/storage.js';
import { runResearchAgent, DEFAULT_QUERIES } from './agents/research.js';
import { runLinkedInAgent } from './agents/linkedin.js';
import { runTwitterAgent } from './agents/twitter.js';

const KEYS_STORE = 'newsroom.keys';
const PREFS_STORE = 'newsroom.prefs';
const PICK = 3;

const defaultAgents = {
  research: { provider: 'anthropic', model: PROVIDERS.anthropic.defaultModel },
  linkedin: { provider: 'anthropic', model: PROVIDERS.anthropic.defaultModel },
  twitter: { provider: 'anthropic', model: PROVIDERS.anthropic.defaultModel },
};

export default function App() {
  const prefs = load(PREFS_STORE, {
    agents: defaultAgents,
    remember: false,
    queries: DEFAULT_QUERIES.join('\n'),
    recency: 'week',
    ctaLink: '',
    ctaText: '',
    tweetCount: 6,
  });

  // ---- settings ----
  const [keys, setKeys] = useState(() => load(KEYS_STORE, {}));
  const [remember, setRemember] = useState(prefs.remember);
  const [agents, setAgents] = useState({ ...defaultAgents, ...prefs.agents });
  const [showSettings, setShowSettings] = useState(false);

  // ---- research ----
  const [queries, setQueries] = useState(prefs.queries);
  const [recency, setRecency] = useState(prefs.recency);
  const [ideas, setIdeas] = useState([]);
  const [articles, setArticles] = useState([]);
  const [researchStatus, setResearchStatus] = useState('');
  const [researchError, setResearchError] = useState('');
  const [researching, setResearching] = useState(false);
  const [feedback, setFeedback] = useState('');

  // ---- human selection ----
  const [selected, setSelected] = useState([]); // idea ids, in click order
  const [notes, setNotes] = useState({}); // ideaId -> string
  const [approved, setApproved] = useState(false);

  // ---- content options ----
  const [ctaLink, setCtaLink] = useState(prefs.ctaLink);
  const [ctaText, setCtaText] = useState(prefs.ctaText);
  const [ctaOverrides, setCtaOverrides] = useState({}); // ideaId -> url
  const [tweetCount, setTweetCount] = useState(prefs.tweetCount);
  const [tweetOverrides, setTweetOverrides] = useState({}); // ideaId -> number

  // ---- outputs ----
  const [liJobs, setLiJobs] = useState({}); // ideaId -> {status, result, error}
  const [xJobs, setXJobs] = useState({});

  useEffect(() => {
    save(PREFS_STORE, { agents, remember, queries, recency, ctaLink, ctaText, tweetCount });
  }, [agents, remember, queries, recency, ctaLink, ctaText, tweetCount]);

  useEffect(() => {
    if (remember) save(KEYS_STORE, keys);
    else remove(KEYS_STORE);
  }, [keys, remember]);

  const llmFor = (agent) => ({ ...agents[agent], apiKey: keys[agents[agent].provider] });
  const chosenIdeas = selected.map((id) => ideas.find((i) => i.id === id)).filter(Boolean);
  const generating = [...Object.values(liJobs), ...Object.values(xJobs)].some((j) => j.status === 'running');

  // ---------------- Step 1: Research ----------------
  async function research({ withFeedback = false } = {}) {
    setResearching(true);
    setResearchError('');
    setApproved(false);
    setLiJobs({});
    setXJobs({});
    try {
      const { ideas: next, articles: arts } = await runResearchAgent({
        llm: llmFor('research'),
        serpKey: keys.serp,
        queries: queries.split('\n').map((q) => q.trim()).filter(Boolean),
        recency,
        feedback: withFeedback ? feedback : '',
        previous: withFeedback ? ideas : [],
        articles: withFeedback ? articles : undefined,
        onStatus: setResearchStatus,
      });
      setIdeas(next);
      setArticles(arts);
      setSelected([]);
      setNotes({});
      if (withFeedback) setFeedback('');
    } catch (e) {
      setResearchError(e.message);
    } finally {
      setResearching(false);
      setResearchStatus('');
    }
  }

  function toggle(id) {
    setApproved(false);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < PICK ? [...s, id] : s));
  }

  // ---------------- Step 2: LinkedIn + X in parallel ----------------
  async function runLinkedIn(idea) {
    setLiJobs((j) => ({ ...j, [idea.id]: { status: 'running' } }));
    try {
      const result = await runLinkedInAgent({
        llm: llmFor('linkedin'),
        idea,
        ctaLink: ctaOverrides[idea.id]?.trim() || ctaLink,
        ctaText,
        notes: notes[idea.id],
      });
      setLiJobs((j) => ({ ...j, [idea.id]: { status: 'done', result } }));
    } catch (e) {
      setLiJobs((j) => ({ ...j, [idea.id]: { status: 'error', error: e.message } }));
    }
  }

  async function runTwitter(idea) {
    setXJobs((j) => ({ ...j, [idea.id]: { status: 'running' } }));
    try {
      const result = await runTwitterAgent({
        llm: llmFor('twitter'),
        idea,
        tweetCount: tweetOverrides[idea.id] || tweetCount,
        notes: notes[idea.id],
      });
      setXJobs((j) => ({ ...j, [idea.id]: { status: 'done', result } }));
    } catch (e) {
      setXJobs((j) => ({ ...j, [idea.id]: { status: 'error', error: e.message } }));
    }
  }

  function generateAll() {
    // Both agents, all three ideas, run concurrently.
    Promise.all(chosenIdeas.flatMap((idea) => [runLinkedIn(idea), runTwitter(idea)]));
  }

  const editPost = (id, post) =>
    setLiJobs((j) => ({ ...j, [id]: { ...j[id], result: { ...j[id].result, post } } }));
  const editTweet = (id, i, text) =>
    setXJobs((j) => {
      const tweets = [...j[id].result.tweets];
      tweets[i] = text;
      return { ...j, [id]: { ...j[id], result: { ...j[id].result, tweets } } };
    });

  function exportMarkdown() {
    const parts = chosenIdeas.map((idea) => {
      const li = liJobs[idea.id]?.result?.post || '_not generated_';
      const x = (xJobs[idea.id]?.result?.tweets || []).join('\n\n') || '_not generated_';
      return `# ${idea.title}\n\n## LinkedIn\n\n${li}\n\n## X thread\n\n${x}\n`;
    });
    const blob = new Blob([parts.join('\n---\n\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ai-newsroom-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const missingKeys = [
    !keys.serp && 'SerpAPI',
    ...['research', 'linkedin', 'twitter']
      .map((a) => agents[a].provider)
      .filter((p, i, arr) => arr.indexOf(p) === i && !keys[p])
      .map((p) => PROVIDERS[p].label),
  ].filter(Boolean);

  const stepClass = (n) => {
    const current = approved ? 3 : ideas.length ? 2 : 1;
    return n < current ? 'done' : n === current ? 'active' : '';
  };

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Agentic AI Newsroom</h1>
          <p className="muted">Research the latest AI news → you pick 3 → LinkedIn &amp; X agents write in parallel.</p>
        </div>
        <button onClick={() => setShowSettings(true)}>⚙ Settings</button>
      </header>

      <ol className="steps">
        <li className={stepClass(1)}>1 · Research</li>
        <li className={stepClass(2)}>2 · Human review</li>
        <li className={stepClass(3)}>3 · LinkedIn + X</li>
      </ol>

      {missingKeys.length > 0 && (
        <div className="banner">
          Missing keys: {missingKeys.join(', ')}.{' '}
          <button className="link" onClick={() => setShowSettings(true)}>Open settings</button>
        </div>
      )}

      {/* ---------- Step 1 ---------- */}
      <section className="panel">
        <h2>1 · Research Agent</h2>
        <p className="muted small">
          Model: {PROVIDERS[agents.research.provider].label} · {agents.research.model}
        </p>
        <div className="grid2">
          <label>
            Search queries (one per line)
            <textarea rows={6} value={queries} onChange={(e) => setQueries(e.target.value)} />
          </label>
          <div>
            <label>
              Time window
              <select value={recency} onChange={(e) => setRecency(e.target.value)}>
                <option value="day">Past 24 hours</option>
                <option value="week">Past week</option>
                <option value="month">Past month</option>
              </select>
            </label>
            <button className="primary block" disabled={researching} onClick={() => research()}>
              {researching ? 'Researching…' : ideas.length ? 'Run fresh research' : 'Find 10 content ideas'}
            </button>
            {researchStatus && <div className="status"><span className="spinner" /> {researchStatus}</div>}
            {researchError && <div className="error">{researchError}</div>}
            {articles.length > 0 && !researching && (
              <p className="muted small">{articles.length} articles found.</p>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Step 2 ---------- */}
      {ideas.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>2 · Pick your top {PICK}</h2>
            <span className={`pill ${selected.length === PICK ? 'ok' : ''}`}>{selected.length}/{PICK} selected</span>
          </div>
          <div className="ideas">
            {ideas.map((idea, i) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                index={i}
                selected={selected.includes(idea.id)}
                disabled={selected.length >= PICK}
                onToggle={() => toggle(idea.id)}
                notes={notes[idea.id]}
                onNotes={(v) => setNotes({ ...notes, [idea.id]: v })}
              />
            ))}
          </div>

          <div className="feedback">
            <label>
              Not happy with these? Give the Research Agent feedback and regenerate
              <textarea rows={2} value={feedback}
                placeholder="e.g. More about AI agents in sourcing; fewer funding-round stories."
                onChange={(e) => setFeedback(e.target.value)} />
            </label>
            <button disabled={researching || !feedback.trim()} onClick={() => research({ withFeedback: true })}>
              Regenerate ideas with feedback
            </button>
          </div>

          <button className="primary" disabled={selected.length !== PICK} onClick={() => setApproved(true)}>
            ✓ Approve these {PICK} ideas
          </button>
        </section>
      )}

      {/* ---------- Step 3 ---------- */}
      {approved && (
        <section className="panel">
          <h2>3 · Content agents</h2>
          <div className="grid2">
            <fieldset>
              <legend>LinkedIn · {PROVIDERS[agents.linkedin.provider].label} · {agents.linkedin.model}</legend>
              <label>
                CTA link (optional — leave blank for no link)
                <input type="url" value={ctaLink} placeholder="https://your-newsletter.com"
                  onChange={(e) => setCtaLink(e.target.value)} />
              </label>
              <label>
                CTA wording (optional)
                <input value={ctaText} placeholder="Subscribe to my weekly AI-for-procurement newsletter"
                  onChange={(e) => setCtaText(e.target.value)} />
              </label>
            </fieldset>
            <fieldset>
              <legend>X / Twitter · {PROVIDERS[agents.twitter.provider].label} · {agents.twitter.model}</legend>
              <label>
                Tweets per thread: <strong>{tweetCount}</strong>
                <input type="range" min={2} max={15} value={tweetCount}
                  onChange={(e) => setTweetCount(Number(e.target.value))} />
              </label>
            </fieldset>
          </div>

          <table className="per-idea">
            <thead>
              <tr><th>Idea</th><th>CTA link override</th><th>Tweets</th></tr>
            </thead>
            <tbody>
              {chosenIdeas.map((idea) => (
                <tr key={idea.id}>
                  <td>{idea.title}</td>
                  <td>
                    <input type="url" placeholder={ctaLink || 'none'} value={ctaOverrides[idea.id] || ''}
                      onChange={(e) => setCtaOverrides({ ...ctaOverrides, [idea.id]: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" min={1} max={25} placeholder={String(tweetCount)}
                      value={tweetOverrides[idea.id] || ''}
                      onChange={(e) => setTweetOverrides({ ...tweetOverrides, [idea.id]: Number(e.target.value) || undefined })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="row">
            <button className="primary" disabled={generating} onClick={generateAll}>
              {generating ? 'Agents writing…' : 'Run LinkedIn + X agents'}
            </button>
            {Object.keys(liJobs).length > 0 && !generating && (
              <button onClick={exportMarkdown}>Export all as Markdown</button>
            )}
          </div>

          {(Object.keys(liJobs).length > 0 || Object.keys(xJobs).length > 0) && (
            <div className="outputs">
              <div className="col">
                <h3>LinkedIn posts</h3>
                {chosenIdeas.map((idea) => (
                  <LinkedInCard key={idea.id} idea={idea} job={liJobs[idea.id]}
                    onRegenerate={() => runLinkedIn(idea)} onEdit={(v) => editPost(idea.id, v)} />
                ))}
              </div>
              <div className="col">
                <h3>X threads</h3>
                {chosenIdeas.map((idea) => (
                  <TwitterCard key={idea.id} idea={idea} job={xJobs[idea.id]}
                    onRegenerate={() => runTwitter(idea)} onEditTweet={(i, v) => editTweet(idea.id, i, v)} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {showSettings && (
        <Settings keys={keys} setKeys={setKeys} agents={agents} setAgents={setAgents}
          remember={remember} setRemember={setRemember} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
