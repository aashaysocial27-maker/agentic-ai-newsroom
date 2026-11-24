import { PROVIDERS } from '../lib/llm.js';

const AGENTS = [
  { id: 'research', label: 'Research Agent' },
  { id: 'linkedin', label: 'LinkedIn Agent' },
  { id: 'twitter', label: 'X / Twitter Agent' },
];

export default function Settings({ keys, setKeys, agents, setAgents, remember, setRemember, onClose }) {
  const setKey = (id, v) => setKeys({ ...keys, [id]: v });
  const setAgent = (id, patch) => setAgents({ ...agents, [id]: { ...agents[id], ...patch } });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="ghost" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <h3>API keys</h3>
        <p className="muted small">
          Keys stay in your browser and are only sent to the provider (through the local dev-server proxy).
        </p>
        <div className="grid2">
          <label>
            SerpAPI (web search)
            <input type="password" value={keys.serp || ''} placeholder="SerpAPI key"
              onChange={(e) => setKey('serp', e.target.value)} />
          </label>
          {Object.entries(PROVIDERS).map(([id, p]) => (
            <label key={id}>
              {p.label}
              <input type="password" value={keys[id] || ''} placeholder={p.keyHint}
                onChange={(e) => setKey(id, e.target.value)} />
            </label>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember keys on this device (localStorage)
        </label>

        <h3>Model per agent</h3>
        <p className="muted small">Pick any provider for each agent. You can type a custom model ID.</p>
        {AGENTS.map((a) => {
          const cfg = agents[a.id];
          const prov = PROVIDERS[cfg.provider];
          return (
            <div className="agent-row" key={a.id}>
              <strong>{a.label}</strong>
              <select
                value={cfg.provider}
                onChange={(e) => setAgent(a.id, { provider: e.target.value, model: PROVIDERS[e.target.value].defaultModel })}
              >
                {Object.entries(PROVIDERS).map(([id, p]) => (
                  <option key={id} value={id}>{p.label}</option>
                ))}
              </select>
              <input list={`models-${a.id}`} value={cfg.model} onChange={(e) => setAgent(a.id, { model: e.target.value })} />
              <datalist id={`models-${a.id}`}>
                {prov.models.map((m) => <option key={m} value={m} />)}
              </datalist>
              {!keys[cfg.provider] && <span className="warn small">no key</span>}
            </div>
          );
        })}

        <div className="modal-foot">
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
