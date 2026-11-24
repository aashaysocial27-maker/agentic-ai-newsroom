export default function IdeaCard({ idea, index, selected, disabled, onToggle, notes, onNotes }) {
  return (
    <article className={`idea ${selected ? 'selected' : ''}`}>
      <label className="idea-head">
        <input type="checkbox" checked={selected} disabled={disabled && !selected} onChange={onToggle} />
        <span className="idea-num">{index + 1}</span>
        <span className="idea-title">{idea.title}</span>
        {idea.audienceFit != null && <span className="pill" title="Audience fit">fit {idea.audienceFit}/10</span>}
      </label>
      {idea.summary && <p>{idea.summary}</p>}
      {idea.angle && <p><strong>Angle:</strong> {idea.angle}</p>}
      {idea.whyNow && <p className="muted"><strong>Why now:</strong> {idea.whyNow}</p>}
      {idea.hook && <p className="hook">“{idea.hook}”</p>}
      {idea.sources?.length > 0 && (
        <ul className="sources">
          {idea.sources.map((s, i) => (
            <li key={i}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <textarea
          className="notes"
          rows={2}
          placeholder="Optional notes for the writers (e.g. focus on supplier risk, mention SAP Ariba)…"
          value={notes || ''}
          onChange={(e) => onNotes(e.target.value)}
        />
      )}
    </article>
  );
}
