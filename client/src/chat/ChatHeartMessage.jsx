import { useEffect, useRef, useState } from 'react';
import { ChatIcon } from './ChatUI.jsx';

export default function ChatHeartMessage({ message, disabled, busy, onReact, children }) {
  const gesture = useRef(null);
  const previous = useRef(null);
  const timer = useRef(null);
  const mounted = useRef(true);
  const [burst, setBurst] = useState(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); }; }, []);
  function reset() { gesture.current = null; previous.current = null; }
  function start(event) {
    if (disabled || busy || !event.isPrimary || event.button !== 0 || event.target.closest('button, a, input, textarea, select, summary, [role="button"]')) { reset(); return; }
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), type: event.pointerType };
  }
  async function end(event) {
    const tap = gesture.current;
    gesture.current = null;
    if (!tap || tap.id !== event.pointerId || performance.now() - tap.at > 300 || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 12) { previous.current = null; return; }
    const last = previous.current;
    previous.current = tap;
    if (!last || last.type !== tap.type || tap.at - last.at > 330 || Math.hypot(tap.x - last.x, tap.y - last.y) > 24) return;
    previous.current = null;
    if (await onReact(message, true) && mounted.current) {
      clearTimeout(timer.current);
      setBurst((value) => value + 1);
      timer.current = setTimeout(() => setBurst(0), 700);
    }
  }
  return <div className="ch-message-main ch-heart-surface" onPointerDown={start} onPointerUp={end} onPointerCancel={reset} onPointerMove={(event) => { const tap = gesture.current; if (tap && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 12) reset(); }}>
    {children}
    {!message.deleted && message.heart?.count > 0 && <button type="button" className={'ch-heart-pill' + (message.heart.active ? ' is-active' : '')} aria-label={message.heart.active ? 'Зүрхээ буцаах' : 'Зүрх дарах'} aria-pressed={message.heart.active} disabled={disabled || busy} onClick={() => onReact(message, !message.heart.active)}><ChatIcon name="heart" size={15} /><span>{message.heart.count}</span></button>}
    {burst > 0 && <span key={burst} className="ch-heart-burst" aria-hidden="true"><ChatIcon name="heart" size={44} /></span>}
  </div>;
}
