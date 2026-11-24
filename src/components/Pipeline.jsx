import { Linkedin, Search, UserCheck } from 'lucide-react';
import { XLogo } from './ui.jsx';

function Node({ icon, title, sub, state, tone }) {
  return (
    <div className={`node node-${state}`}>
      <div className={`node-icon ${tone || ''}`}>{icon}</div>
      <div>
        <div className="node-title">{title}</div>
        <div className="node-sub">{sub}</div>
      </div>
    </div>
  );
}

/** The Research → Editor → (X ‖ LinkedIn) flow diagram with live status. */
export default function Pipeline({ research, editor, twitter, linkedin }) {
  return (
    <div className="pipeline">
      <Node icon={<Search size={16} />} title="Research Agent" {...research} />
      <div className={`wire ${editor.state !== 'idle' ? 'lit' : ''}`} />
      <Node icon={<UserCheck size={16} />} title="You · Editor" tone="warm" {...editor} />
      <div className="fork">
        <div className={`wire ${twitter.state !== 'idle' ? 'lit' : ''}`} />
        <div className="branches">
          <Node icon={<XLogo size={14} />} title="Twitter/X Agent" {...twitter} />
          <Node icon={<Linkedin size={16} />} title="LinkedIn Agent" tone="li" {...linkedin} />
        </div>
      </div>
    </div>
  );
}
