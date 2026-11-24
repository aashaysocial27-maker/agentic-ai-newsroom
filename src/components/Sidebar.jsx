import { Globe, KeyRound, Search, Settings2, Sparkles, Users, Linkedin, CircleAlert } from 'lucide-react';
import { MODELS, PROVIDERS, SERP, modelInfo } from '../lib/models.js';
import { Segmented, SecretField, Toggle, XLogo } from './ui.jsx';

const CUSTOM = '__custom__';

function ModelSelect({ value, onChange }) {
  const info = modelInfo(value);
  const selectValue = info.custom ? CUSTOM : `${value.provider}:${value.model}`;
  return (
    <div className="model-select">
      <select
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === CUSTOM) return onChange({ provider: value.provider, model: '' });
          const [provider, ...rest] = e.target.value.split(':');
          onChange({ provider, model: rest.join(':') });
        }}
      >
        {Object.entries(PROVIDERS).map(([pid, p]) => (
          <optgroup key={pid} label={p.label}>
            {MODELS.filter((m) => m.provider === pid).map((m) => (
              <option key={m.id} value={`${pid}:${m.id}`}>
                {m.label}{m.webSearch ? '  · web search' : ''}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM}>Custom model ID…</option>
      </select>
      {info.custom && (
        <div className="custom-model">
          <select value={value.provider} onChange={(e) => onChange({ ...value, provider: e.target.value })}>
            {Object.entries(PROVIDERS).map(([pid, p]) => <option key={pid} value={pid}>{p.label}</option>)}
          </select>
          <input value={value.model} placeholder="model-id" spellCheck={false}
            onChange={(e) => onChange({ ...value, model: e.target.value.trim() })} />
        </div>
      )}
    </div>
  );
}

const CREW = [
  { id: 'research', name: 'Research Agent', desc: 'Scans the web for the latest AI news', icon: <Search size={15} /> },
  { id: 'twitter', name: 'Twitter/X Agent', desc: 'Writes scroll-stopping tweet threads', icon: <XLogo size={13} /> },
  { id: 'linkedin', name: 'LinkedIn Agent', desc: 'Writes posts for supply chain leaders', icon: <Linkedin size={15} /> },
];

export default function Sidebar({
  keys, setKey, remember, setRemember,
  sharedModel, setSharedModel, perAgent, setPerAgent, agents, setAgent,
  recency, setRecency, searchSource, setSearchSource, focus, setFocus,
  profile, setProfile, crewStatus, serpNeeded,
}) {
  const research = modelInfo(agents.research);
  const providersInUse = [...new Set(Object.values(agents).map((a) => a.provider))];

  let serpStatus;
  let serpNote;
  if (keys.serp) serpStatus = { tone: 'ok', text: 'Added' };
  else if (serpNeeded) serpStatus = { tone: 'warn', text: 'Required' };
  else serpStatus = { tone: 'muted', text: 'Optional' };
  if (!research.webSearch) serpNote = `${research.label || 'This model'} has no built-in web search, so research uses SerpAPI.`;
  else if (searchSource === 'native') serpNote = `Not needed: ${research.label} searches the web itself.`;
  else serpNote = 'Research uses SerpAPI (Google News).';

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo"><Sparkles size={18} /></div>
        <div>
          <div className="brand-name">Agentic Newsroom</div>
          <div className="brand-sub">AI news → content, with agents</div>
        </div>
      </div>

      <section>
        <h4><KeyRound size={13} /> API keys</h4>
        {providersInUse.map((pid) => (
          <SecretField key={pid} label={PROVIDERS[pid].keyLabel} placeholder={PROVIDERS[pid].keyHint}
            value={keys[pid]} onChange={(v) => setKey(pid, v)} keyUrl={PROVIDERS[pid].keyUrl}
            status={keys[pid] ? { tone: 'ok', text: 'Added' } : { tone: 'warn', text: 'Required' }} />
        ))}
        <SecretField label={SERP.keyLabel} placeholder={SERP.keyHint} value={keys.serp}
          onChange={(v) => setKey('serp', v)} keyUrl={SERP.keyUrl} status={serpStatus} note={serpNote} />
        <Toggle checked={remember} onChange={setRemember} label="Remember keys on this device" />
      </section>

      <section>
        <h4><Settings2 size={13} /> Model</h4>
        {!perAgent ? (
          <>
            <ModelSelect value={sharedModel} onChange={setSharedModel} />
            <div className="caption">Shared by all three agents</div>
          </>
        ) : (
          CREW.map((c) => (
            <div key={c.id} className="per-agent">
              <div className="caption strong">{c.name}</div>
              <ModelSelect value={agents[c.id]} onChange={(v) => setAgent(c.id, v)} />
            </div>
          ))
        )}
        <div className={`capability ${research.webSearch ? 'yes' : 'no'}`}>
          {research.webSearch ? <Globe size={13} /> : <CircleAlert size={13} />}
          {research.webSearch
            ? <span>Built-in web search{research.custom ? ' (assumed)' : ''}: {PROVIDERS[research.provider].searchTool}</span>
            : <span>No built-in web search, so SerpAPI is required</span>}
        </div>
        <Toggle checked={perAgent} onChange={setPerAgent} label="Different model per agent" />
      </section>

      <section>
        <h4><Search size={13} /> Research settings</h4>
        <div className="field-head"><span>News window</span></div>
        <Segmented value={recency} onChange={setRecency} options={[
          { value: 'day', label: '24 hours' },
          { value: 'week', label: '7 days' },
          { value: 'month', label: '30 days' },
        ]} />
        <div className="field-head"><span>Search source</span></div>
        <Segmented value={searchSource} onChange={setSearchSource} options={[
          { value: 'native', label: 'Model’s web search', disabled: !research.webSearch,
            title: research.webSearch ? '' : 'This model has no built-in web search' },
          { value: 'serp', label: 'SerpAPI' },
        ]} />
        <label className="field">
          <div className="field-head"><span>Focus (optional)</span></div>
          <textarea rows={2} value={focus} placeholder="e.g. AI agents in sourcing, supplier risk, SAP Ariba"
            onChange={(e) => setFocus(e.target.value)} />
        </label>
      </section>

      <section>
        <h4><Linkedin size={13} /> LinkedIn preview</h4>
        <label className="field">
          <input value={profile.name} placeholder="Your Name" onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </label>
        <label className="field">
          <input value={profile.headline} placeholder="Headline" onChange={(e) => setProfile({ ...profile, headline: e.target.value })} />
        </label>
      </section>

      <section>
        <h4><Users size={13} /> Agent crew</h4>
        {CREW.map((c) => (
          <div key={c.id} className="crew">
            <div className="crew-icon">{c.icon}</div>
            <div className="crew-text">
              <div className="crew-name">{c.name}</div>
              <div className="crew-desc">{c.desc}</div>
              <div className="crew-model">{agents[c.id].model || 'no model'}</div>
            </div>
            <span className={`dot dot-${crewStatus[c.id]}`} title={crewStatus[c.id]} />
          </div>
        ))}
      </section>
    </aside>
  );
}
