import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, ExternalLink } from 'lucide-react';

export function XLogo({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
    </svg>
  );
}

export function CopyButton({ text, label = 'Copy', className = 'btn-sm' }) {
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
  return (
    <button className={className} onClick={copy}>
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? 'Copied' : label}
    </button>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track"><span className="thumb" /></span>
      {label}
    </label>
  );
}

export function SecretField({ label, value, onChange, placeholder, keyUrl, status, note }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <div className="field-head">
        <span>{label}</span>
        {status && <span className={`tag tag-${status.tone}`}>{status.text}</span>}
      </div>
      <div className="secret">
        <input
          type={show ? 'text' : 'password'}
          value={value || ''}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value.trim())}
        />
        <button className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Hide key' : 'Show key'}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {note && <div className="field-note">{note}</div>}
      {keyUrl && (
        <a className="get-key" href={keyUrl} target="_blank" rel="noreferrer">
          Get a key <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

/** Textarea that grows with its content — used for in-place editing of posts and tweets. */
export function AutoText({ value, onChange, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea ref={ref} className={`autotext ${className || ''}`} value={value} rows={1}
      onChange={(e) => onChange(e.target.value)} />
  );
}

export function Stepper({ value, onChange, min = 1, max = 25 }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="Fewer">−</button>
      <span>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label="More">+</button>
    </div>
  );
}
