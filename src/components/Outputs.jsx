import { useState } from 'react';

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };
  return <button className="small-btn" onClick={copy}>{done ? 'Copied ✓' : label}</button>;
}

function Status({ job }) {
  if (job?.status === 'running') return <div className="status"><span className="spinner" /> Writing…</div>;
  if (job?.status === 'error') return <div className="error">{job.error}</div>;
  return null;
}

export function LinkedInCard({ idea, job, onRegenerate, onEdit }) {
  const post = job?.result?.post || '';
  return (
    <div className="out-card">
      <div className="out-head">
        <span className="badge li">in</span>
        <strong>{idea.title}</strong>
      </div>
      <Status job={job} />
      {job?.result && (
        <>
          <textarea className="post" rows={14} value={post} onChange={(e) => onEdit(e.target.value)} />
          <div className="out-foot">
            <span className={`count ${post.length > 3000 ? 'over' : ''}`}>{post.length} / 3000</span>
            <CopyButton text={post} />
            <button className="small-btn" onClick={onRegenerate}>Regenerate</button>
          </div>
        </>
      )}
      {job?.status === 'error' && <button className="small-btn" onClick={onRegenerate}>Retry</button>}
    </div>
  );
}

export function TwitterCard({ idea, job, onRegenerate, onEditTweet }) {
  const tweets = job?.result?.tweets || [];
  const max = job?.result?.maxChars || 280;
  return (
    <div className="out-card">
      <div className="out-head">
        <span className="badge x">𝕏</span>
        <strong>{idea.title}</strong>
      </div>
      <Status job={job} />
      {tweets.length > 0 && (
        <>
          <ol className="thread">
            {tweets.map((t, i) => (
              <li key={i}>
                <textarea rows={3} value={t} onChange={(e) => onEditTweet(i, e.target.value)} />
                <div className="tweet-foot">
                  <span className={`count ${t.length > max ? 'over' : ''}`}>{t.length}/{max}</span>
                  <CopyButton text={t} />
                </div>
              </li>
            ))}
          </ol>
          <div className="out-foot">
            <span className="count">{tweets.length} tweets</span>
            <CopyButton text={tweets.join('\n\n')} label="Copy thread" />
            <button className="small-btn" onClick={onRegenerate}>Regenerate</button>
          </div>
        </>
      )}
      {job?.status === 'error' && <button className="small-btn" onClick={onRegenerate}>Retry</button>}
    </div>
  );
}
