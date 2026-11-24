import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Loader2, Monitor, Moon, Sparkles, Sun, Wand2, Check, ExternalLink, Linkedin } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import Pipeline from './components/Pipeline.jsx';
import { LinkedInCard, ThreadCard } from './components/Content.jsx';
import { Stepper, XLogo } from './components/ui.jsx';
import { DEFAULT_MODEL, PROVIDERS, modelInfo, serpRequired } from './lib/models.js';
import { load, save, remove } from './lib/storage.js';
import { runResearchAgent } from './agents/research.js';
import { runLinkedInAgent } from './agents/linkedin.js';
import { runTwitterAgent } from './agents/twitter.js';

const KEYS_STORE = 'newsroom.keys';
const PREFS_STORE = 'newsroom.prefs.v2';
const PICK = 3;
const WINDOW_TEXT = { day: '24 hours', week: '7 days', month: '30 days' };

export default function App() {
  const prefs = load(PREFS_STORE, {
    theme: 'system',
    remember: false,
    sharedModel: DEFAULT_MODEL,
    perAgent: false,
    agentModels: { research: DEFAULT_MODEL, twitter: DEFAULT_MODEL, linkedin: DEFAULT_MODEL },
    recency: 'day',
    searchSource: 'native',
    focus: '',
    ctaLink: '',
    ctaText: '',
    tweetCount: 6,
    profile: { name: '', headline: 'Supply chain & AI' },
  });

  // ---------- settings ----------
  const [theme, setTheme] = useState(prefs.theme);
  const [keys, setKeys] = useState(() => load(KEYS_STORE, {}));
  const [remember, setRemember] = useState(prefs.remember);
  const [sharedModel, setSharedModel] = useState(prefs.sharedModel);
  const [perAgent, setPerAgent] = useState(prefs.perAgent);
  const [agentModels, setAgentModels] = useState(prefs.agentModels);
  const [recency, setRecency] = useState(prefs.recency);
  const [searchPref, setSearchPref] = useState(prefs.searchSource);
  const [focus, setFocus] = useState(prefs.focus);
  const [profile, setProfile] = useState(prefs.profile);

  // ---------- workflow ----------
  const [stage, setStage] = useState('research'); // research | review | brief | content
  const [ideas, setIdeas] = useState([]);
  const [articles, setArticles] = useState([]);
  const [researching, setResearching] = useState(false);
  const [researchStatus, setResearchStatus] = useState('');
  const [researchError, setResearchError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState({});
  const [ctaLink, setCtaLink] = useState(prefs.ctaLink);
  const [ctaText, setCtaText] = useState(prefs.ctaText);
  const [ctaOverrides, setCtaOverrides] = useState({});
  const [tweetCount, setTweetCount] = useState(prefs.tweetCount);
  const [tweetOverrides, setTweetOverrides] = useState({});
  const [liJobs, setLiJobs] = useState({});
  const [xJobs, setXJobs] = useState({});
  const [activeTab, setActiveTab] = useState(null);

  const agents = perAgent
    ? agentModels
    : { research: sharedModel, twitter: sharedModel, linkedin: sharedModel };
  const researchInfo = modelInfo(agents.research);
  const searchSource = researchInfo.webSearch ? searchPref : 'serp';
  const serpNeeded = serpRequired(agents.research, searchPref);

  // ---------- persistence ----------
  useEffect(() => {
    save(PREFS_STORE, {
      theme, remember, sharedModel, perAgent, agentModels, recency,
      searchSource: searchPref, focus, ctaLink, ctaText, tweetCount, profile,
    });
  }, [theme, remember, sharedModel, perAgent, agentModels, recency, searchPref, focus, ctaLink, ctaText, tweetCount, profile]);

  useEffect(() => {
    if (remember) save(KEYS_STORE, keys);
    else remove(KEYS_STORE);
  }, [keys, remember]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  const setKey = (id, v) => setKeys((k) => ({ ...k, [id]: v }));
  const setAgent = (id, v) => setAgentModels((m) => ({ ...m, [id]: v }));
  const llmFor = (agent) => ({ ...agents[agent], apiKey: keys[agents[agent].provider] });
  const chosen = useMemo(() => selected.map((id) => ideas.find((i) => i.id === id)).filter(Boolean), [selected, ideas]);

  const allJobs = [...Object.values(liJobs), ...Object.values(xJobs)];
  const writing = allJobs.some((j) => j.status === 'running');

  // ---------- missing-key checks ----------
  const missing = (list) => list.filter((x, i, a) => a.indexOf(x) === i && !keys[x]);
  const researchMissing = missing([agents.research.provider, ...(serpNeeded ? ['serp'] : [])]);
  const writersMissing = missing([agents.twitter.provider, agents.linkedin.provider]);
  const nameOf = (k) => (k === 'serp' ? 'SerpAPI' : PROVIDERS[k].label);

  // ---------- Research Agent ----------
  async function research(withFeedback = false) {
    setResearching(true);
    setResearchError('');
    try {
      const out = await runResearchAgent({
        llm: llmFor('research'),
        searchSource,
        serpKey: keys.serp,
        focus,
        recency,
        feedback: withFeedback ? feedback : '',
        previous: withFeedback ? ideas : [],
        articles: withFeedback && searchSource === 'serp' ? articles : undefined,
        onStatus: setResearchStatus,
      });
      setIdeas(out.ideas);
      setArticles(out.articles);
      setSelected([]);
      setNotes({});
      setLiJobs({});
      setXJobs({});
      setFeedback('');
      setStage('review');
    } catch (e) {
      setResearchError(e.message);
    } finally {
      setResearching(false);
      setResearchStatus('');
    }
  }

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < PICK ? [...s, id] : s));
  }

  // ---------- Writers ----------
  async function runLinkedIn(idea) {
    setLiJobs((j) => ({ ...j, [idea.id]: { ...j[idea.id], status: 'running' } }));
    try {
      const result = await runLinkedInAgent({
        llm: llmFor('linkedin'), idea, ctaText, notes: notes[idea.id],
        ctaLink: ctaOverrides[idea.id]?.trim() || ctaLink,
      });
      setLiJobs((j) => ({ ...j, [idea.id]: { status: 'done', result } }));
    } catch (e) {
      setLiJobs((j) => ({ ...j, [idea.id]: { ...j[idea.id], status: 'error', error: e.message } }));
    }
  }

  async function runTwitter(idea) {
    setXJobs((j) => ({ ...j, [idea.id]: { ...j[idea.id], status: 'running' } }));
    try {
      const result = await runTwitterAgent({
        llm: llmFor('twitter'), idea, notes: notes[idea.id],
        tweetCount: tweetOverrides[idea.id] || tweetCount,
      });
      setXJobs((j) => ({ ...j, [idea.id]: { status: 'done', result } }));
    } catch (e) {
      setXJobs((j) => ({ ...j, [idea.id]: { ...j[idea.id], status: 'error', error: e.message } }));
    }
  }

  function runWriters() {
    setLiJobs({});
    setXJobs({});
    setActiveTab(chosen[0]?.id);
    setStage('content');
    // Twitter/X and LinkedIn agents run simultaneously, for all three stories.
    chosen.forEach((idea) => {
      runTwitter(idea);
      runLinkedIn(idea);
    });
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
    const md = chosen
      .map((idea) => {
        const li = liJobs[idea.id]?.result?.post || '_not generated_';
        const x = (xJobs[idea.id]?.result?.tweets || []).join('\n\n') || '_not generated_';
        const src = (idea.sources || []).map((s) => `- [${s.title || s.url}](${s.url})`).join('\n');
        return `# ${idea.title}\n\n${src}\n\n## X thread\n\n${x}\n\n## LinkedIn\n\n${li}\n`;
      })
      .join('\n---\n\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = `newsroom-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function newRun() {
    setStage('research');
    setIdeas([]);
    setArticles([]);
    setSelected([]);
    setNotes({});
    setLiJobs({});
    setXJobs({});
    setCtaOverrides({});
    setTweetOverrides({});
  }

  // ---------- status for pipeline + crew ----------
  const jobState = (jobs) => {
    const v = Object.values(jobs);
    if (!v.length) return 'idle';
    if (v.some((j) => j.status === 'running')) return 'running';
    if (v.some((j) => j.status === 'error')) return 'error';
    return 'done';
  };
  const readyCount = (jobs) => Object.values(jobs).filter((j) => j.status === 'done').length;
  const researchState = researching ? 'running' : researchError ? 'error' : ideas.length ? 'done' : 'idle';
  const editorState = stage === 'review' ? 'running' : ['brief', 'content'].includes(stage) ? 'done' : 'idle';
  const xState = jobState(xJobs);
  const liState = jobState(liJobs);
  const sub = (state, done, idle) =>
    state === 'running' ? 'Working…' : state === 'error' ? 'Needs attention' : state === 'done' ? done : idle;

  const crewStatus = { research: researchState, twitter: xState, linkedin: liState };
  const activeIdea = chosen.find((i) => i.id === activeTab) || chosen[0];
  const activeIndex = chosen.indexOf(activeIdea);

  return (
    <div className="shell">
      <Sidebar
        keys={keys} setKey={setKey} remember={remember} setRemember={setRemember}
        sharedModel={sharedModel} setSharedModel={setSharedModel}
        perAgent={perAgent} setPerAgent={(v) => { if (v) setAgentModels({ research: sharedModel, twitter: sharedModel, linkedin: sharedModel }); setPerAgent(v); }}
        agents={agents} setAgent={setAgent}
        recency={recency} setRecency={setRecency}
        searchSource={searchSource} setSearchSource={setSearchPref}
        focus={focus} setFocus={setFocus} profile={profile} setProfile={setProfile}
        crewStatus={crewStatus} serpNeeded={serpNeeded}
      />

      <main className="main">
        <header className="main-head">
          <div>
            <h1 className="serif">Content pipeline</h1>
            <p className="muted">Research → Human approval → Twitter &amp; LinkedIn agents</p>
          </div>
          <div className="head-tools">
            <span className="model-pill"><Sparkles size={13} /> {perAgent ? 'Per-agent models' : sharedModel.model || 'no model'}</span>
            <div className="theme-toggle" role="radiogroup" aria-label="Theme">
              {[['light', Sun], ['dark', Moon], ['system', Monitor]].map(([t, Icon]) => (
                <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)} aria-label={`${t} theme`}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
        </header>

        <Pipeline
          research={{ state: researchState, sub: sub(researchState, `${articles.length} stories found`, 'Ready') }}
          editor={{ state: editorState, sub: stage === 'review' ? `${selected.length}/${PICK} picked` : editorState === 'done' ? `${chosen.length} approved` : 'Waiting' }}
          twitter={{ state: xState, sub: sub(xState, `${readyCount(xJobs)} piece${readyCount(xJobs) === 1 ? '' : 's'} ready`, 'Waiting') }}
          linkedin={{ state: liState, sub: sub(liState, `${readyCount(liJobs)} piece${readyCount(liJobs) === 1 ? '' : 's'} ready`, 'Waiting') }}
        />

        {/* ===== STEP 1 · RESEARCH ===== */}
        {stage === 'research' && (
          <section className="stage">
            <div className="eyebrow">Step 1 · Research</div>
            <div className="stage-head">
              <div>
                <h2 className="serif">What’s new in AI?</h2>
                <p className="muted">
                  The Research Agent scans the last {WINDOW_TEXT[recency]} of AI news{' '}
                  {searchSource === 'native'
                    ? <>using <strong>{researchInfo.label}</strong>’s built-in web search</>
                    : <>through <strong>SerpAPI</strong> (Google News)</>}
                  {focus.trim() && <> with a focus on <em>{focus.trim()}</em></>}, then pitches 10 story ideas.
                </p>
              </div>
              <button className="btn-primary" disabled={researching || researchMissing.length > 0} onClick={() => research()}>
                {researching ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />} {researching ? 'Researching…' : 'Run research'}
              </button>
            </div>
            {researchMissing.length > 0 && (
              <div className="notice">Add your {researchMissing.map(nameOf).join(' and ')} key in the sidebar to start.</div>
            )}
            {researchStatus && <div className="status"><Loader2 size={14} className="spin" /> {researchStatus}</div>}
            {researchError && <div className="error">{researchError}</div>}
            {researching && (
              <div className="idea-grid">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="idea-card ghost"><div className="skeleton"><span /><span /><span /></div></div>)}
              </div>
            )}
          </section>
        )}

        {/* ===== STEP 2 · HUMAN APPROVAL ===== */}
        {stage === 'review' && (
          <section className="stage">
            <div className="eyebrow">Step 2 · Human approval</div>
            <div className="stage-head">
              <div>
                <h2 className="serif">Pick your top {PICK}</h2>
                <p className="muted">{ideas.length} ideas from {articles.length} stories. Choose the three worth publishing.</p>
              </div>
              <div className="actions">
                <button className="btn" onClick={newRun}><ArrowLeft size={14} /> New research</button>
                <button className="btn-primary" disabled={selected.length !== PICK} onClick={() => setStage('brief')}>
                  Approve {selected.length}/{PICK} <ArrowRight size={14} />
                </button>
              </div>
            </div>

            <div className="idea-grid">
              {ideas.map((idea, i) => {
                const on = selected.includes(idea.id);
                const blocked = !on && selected.length >= PICK;
                return (
                  <div key={idea.id} className={`idea-card ${on ? 'on' : ''} ${blocked ? 'blocked' : ''}`}
                    role="checkbox" aria-checked={on} aria-disabled={blocked} tabIndex={0}
                    onClick={() => !blocked && toggle(idea.id)}
                    onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !blocked) { e.preventDefault(); toggle(idea.id); } }}>
                    <div className="idea-top">
                      <span className="idea-num">#{i + 1}</span>
                      {idea.audienceFit != null && <span className="fit">fit {idea.audienceFit}/10</span>}
                      <span className={`check ${on ? 'on' : ''}`}>{on && <Check size={12} />}</span>
                    </div>
                    <h3>{idea.title}</h3>
                    {idea.summary && <p>{idea.summary}</p>}
                    {idea.angle && <p className="angle"><strong>Angle</strong> {idea.angle}</p>}
                    {idea.hook && <p className="hook">“{idea.hook}”</p>}
                    {idea.sources?.length > 0 && (
                      <div className="src-row">
                        {idea.sources.slice(0, 3).map((s, k) => (
                          <a key={k} href={s.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            {safeHost(s.url)} <ExternalLink size={10} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="feedback-bar">
              <textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)}
                placeholder="Not quite right? Tell the Research Agent what to change, e.g. “more on AI agents in sourcing, skip funding rounds”." />
              <button className="btn" disabled={researching || !feedback.trim()} onClick={() => research(true)}>
                {researching ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />} Regenerate ideas
              </button>
            </div>
            {researchStatus && <div className="status"><Loader2 size={14} className="spin" /> {researchStatus}</div>}
            {researchError && <div className="error">{researchError}</div>}
          </section>
        )}

        {/* ===== STEP 3 · BRIEF THE WRITERS ===== */}
        {stage === 'brief' && (
          <section className="stage">
            <div className="eyebrow">Step 3 · Brief the writers</div>
            <div className="stage-head">
              <div>
                <h2 className="serif">Brief your writers</h2>
                <p className="muted">Both agents run in parallel on your {PICK} approved stories.</p>
              </div>
              <div className="actions">
                <button className="btn" onClick={() => setStage('review')}><ArrowLeft size={14} /> Back to ideas</button>
                <button className="btn-primary" disabled={writersMissing.length > 0} onClick={runWriters}>
                  <Wand2 size={15} /> Run writers
                </button>
              </div>
            </div>
            {writersMissing.length > 0 && (
              <div className="notice">Add your {writersMissing.map(nameOf).join(' and ')} key in the sidebar.</div>
            )}

            <div className="brief-grid">
              <div className="panel">
                <div className="panel-title"><span className="content-icon x"><XLogo size={13} /></span> Twitter/X Agent</div>
                <div className="field-head"><span>Tweets per thread</span></div>
                <Stepper value={tweetCount} onChange={setTweetCount} min={2} max={15} />
                <div className="caption">Written for procurement experts. You can change the count for each story below.</div>
              </div>
              <div className="panel">
                <div className="panel-title"><span className="content-icon li"><Linkedin size={14} /></span> LinkedIn Agent</div>
                <label className="field">
                  <div className="field-head"><span>CTA link</span><span className="tag tag-muted">optional</span></div>
                  <input type="url" value={ctaLink} placeholder="https://your-newsletter.com" onChange={(e) => setCtaLink(e.target.value)} />
                </label>
                <label className="field">
                  <div className="field-head"><span>CTA wording</span><span className="tag tag-muted">optional</span></div>
                  <input value={ctaText} placeholder="Get my weekly AI-for-procurement brief" onChange={(e) => setCtaText(e.target.value)} />
                </label>
                <div className="caption">Leave the link blank and posts won’t include one.</div>
              </div>
            </div>

            <div className="story-list">
              {chosen.map((idea, i) => (
                <div key={idea.id} className="story">
                  <div className="story-num">{i + 1}</div>
                  <div className="story-main">
                    <h3>{idea.title}</h3>
                    <textarea rows={2} value={notes[idea.id] || ''} placeholder="Notes for both writers (optional)"
                      onChange={(e) => setNotes({ ...notes, [idea.id]: e.target.value })} />
                    <div className="story-opts">
                      <label>
                        CTA link for this post
                        <input type="url" value={ctaOverrides[idea.id] || ''} placeholder={ctaLink || 'none'}
                          onChange={(e) => setCtaOverrides({ ...ctaOverrides, [idea.id]: e.target.value })} />
                      </label>
                      <label>
                        Tweets
                        <Stepper value={tweetOverrides[idea.id] || tweetCount} min={1} max={25}
                          onChange={(v) => setTweetOverrides({ ...tweetOverrides, [idea.id]: v })} />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== STEP 4 · CONTENT ===== */}
        {stage === 'content' && activeIdea && (
          <section className="stage">
            <div className="eyebrow">Step 4 · {writing ? 'Writers at work' : 'Content ready for review'}</div>
            <div className="stage-head">
              <div>
                <h2 className="serif">{writing ? 'Writing your content…' : 'Your content is ready'}</h2>
                <p className="muted">Review, tweak and copy. Regenerate any piece you don’t love.</p>
              </div>
              <div className="actions">
                <button className="btn" onClick={() => setStage('brief')}><ArrowLeft size={14} /> Re-brief</button>
                <button className="btn" disabled={writing} onClick={exportMarkdown}><Download size={14} /> Export .md</button>
                <button className="btn-primary" onClick={newRun}><Sparkles size={14} /> New run</button>
              </div>
            </div>

            <div className="tabs">
              {chosen.map((idea, i) => {
                const busy = xJobs[idea.id]?.status === 'running' || liJobs[idea.id]?.status === 'running';
                return (
                  <button key={idea.id} className={`tab ${idea.id === activeIdea.id ? 'on' : ''}`} onClick={() => setActiveTab(idea.id)} title={idea.title}>
                    <span className="tab-num">#{i + 1}</span>
                    <span className="tab-title">{idea.title}</span>
                    {busy && <Loader2 size={12} className="spin" />}
                  </button>
                );
              })}
            </div>

            <div className="content-grid">
              <ThreadCard idea={activeIdea} index={activeIndex} job={xJobs[activeIdea.id]}
                onRegenerate={() => runTwitter(activeIdea)} onEditTweet={(i, v) => editTweet(activeIdea.id, i, v)} />
              <LinkedInCard job={liJobs[activeIdea.id]} profile={profile}
                onRegenerate={() => runLinkedIn(activeIdea)} onEdit={(v) => editPost(activeIdea.id, v)} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function safeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}
