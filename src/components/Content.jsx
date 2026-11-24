import { Linkedin, Loader2, RefreshCw } from 'lucide-react';
import { AutoText, CopyButton, XLogo } from './ui.jsx';

function Skeleton({ lines = 6 }) {
  return (
    <div className="skeleton">
      {Array.from({ length: lines }, (_, i) => <span key={i} style={{ width: `${60 + ((i * 37) % 40)}%` }} />)}
    </div>
  );
}

function CardShell({ icon, iconClass, title, job, onRegenerate, children }) {
  const running = job?.status === 'running';
  return (
    <div className="content-card">
      <div className="content-head">
        <div className={`content-icon ${iconClass}`}>{icon}</div>
        <h3>{title}</h3>
        <button className="btn-sm" disabled={running} onClick={onRegenerate}>
          {running ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} Regenerate
        </button>
      </div>
      {running && !job.result && <Skeleton />}
      {job?.status === 'error' && <div className="error">{job.error}</div>}
      {job?.result && <div className={running ? 'dim' : ''}>{children}</div>}
    </div>
  );
}

export function ThreadCard({ idea, index, job, onRegenerate, onEditTweet }) {
  const tweets = job?.result?.tweets || [];
  const max = job?.result?.maxChars || 280;
  return (
    <CardShell icon={<XLogo size={14} />} iconClass="x" title="Twitter/X thread" job={job} onRegenerate={onRegenerate}>
      <div className="thread-box">
        <div className="thread-top">
          <span className="thread-label">Thread {index + 1}</span>
          <span className="thread-title">{idea.title}</span>
          <CopyButton text={tweets.join('\n\n')} label="Copy thread" />
        </div>
        <ol className="tweets">
          {tweets.map((t, i) => (
            <li key={i} className="tweet">
              <div className="tweet-avatar"><XLogo size={12} /></div>
              <div className="tweet-body">
                <AutoText value={t} onChange={(v) => onEditTweet(i, v)} />
                <div className="tweet-foot">
                  <span className={`count ${t.length > max ? 'over' : ''}`}>{t.length}/{max}</span>
                  <CopyButton text={t} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </CardShell>
  );
}

export function LinkedInCard({ job, profile, onRegenerate, onEdit }) {
  const post = job?.result?.post || '';
  const initials = (profile.name || 'You').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <CardShell icon={<Linkedin size={15} />} iconClass="li" title="LinkedIn post" job={job} onRegenerate={onRegenerate}>
      <div className="li-preview">
        <div className="li-author">
          <div className="li-avatar">{initials}</div>
          <div>
            <div className="li-name">{profile.name || 'Your Name'}</div>
            <div className="li-meta">{profile.headline || 'Headline'} · now</div>
          </div>
        </div>
        <AutoText className="li-body" value={post} onChange={onEdit} />
      </div>
      <div className="content-foot">
        <span className={`count ${post.length > 3000 ? 'over' : ''}`}>{post.length} / 3000</span>
        <CopyButton text={post} label="Copy post" />
      </div>
    </CardShell>
  );
}
