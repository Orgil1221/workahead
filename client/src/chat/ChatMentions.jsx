import { useEffect, useId, useState } from 'react';
import { api } from '../api/client.js';
import { Avatar, Badges, PersonName } from './ChatUI.jsx';
import { mentionQuery, moveMentions } from './chatText.js';

export function useChatMentions({ value, onChange, roomId, disabled, composerRef }) {
  const [mentions, setMentions] = useState([]);
  const [query, setQuery] = useState(null);
  const [people, setPeople] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listId = useId();
  const text = query?.text;
  const open = text != null && !disabled;

  function reset() { setMentions([]); setQuery(null); }

  useEffect(() => { setMentions([]); setQuery(null); }, [roomId]);
  useEffect(() => { if (!value) { setMentions([]); setQuery(null); } }, [value]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPeople([]); setLoading(true); setError(''); setIndex(0);
    const timer = setTimeout(() => {
      api('/chat/people?' + new URLSearchParams({ room: roomId, q: text.trim() }))
        .then((result) => { if (active) setPeople(result.people); })
        .catch((failure) => { if (active) setError(failure.message); })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [text, roomId, open]);

  useEffect(() => {
    if (!open) return;
    const close = (event) => { if (event.target !== composerRef.current && !event.target.closest('.ch-mention-picker')) setQuery(null); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open, composerRef]);

  useEffect(() => { if (open) document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: 'nearest' }); }, [index, open, listId]);

  function change(next, start = next.length, end = start) {
    const adjusted = moveMentions(value, next, mentions);
    setMentions(adjusted); setQuery(mentionQuery(next, start, end, adjusted));
    onChange(next);
  }

  function select(person) {
    if (!query || disabled) return;
    if (mentions.length >= 10) { setError('Нэг мессежид 10 хүртэл mention оруулна.'); return; }
    const label = '@' + person.name;
    const next = value.slice(0, query.start) + label + ' ' + value.slice(query.end);
    if (next.length > 2000) { setError('Мессеж 2000 тэмдэгтээс хэтрэхгүй байна.'); return; }
    setMentions([...moveMentions(value, next, mentions), { userId: person.id, start: query.start, end: query.start + label.length }].sort((first, second) => first.start - second.start));
    onChange(next); setQuery(null);
    const caret = query.start + label.length + 1;
    requestAnimationFrame(() => { composerRef.current?.focus(); composerRef.current?.setSelectionRange(caret, caret); });
  }

  function onKeyDown(event) {
    if (!open || event.nativeEvent.isComposing) return false;
    if (event.key === 'Escape') { event.preventDefault(); setQuery(null); return true; }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && people.length) {
      event.preventDefault(); setIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + people.length) % people.length); return true;
    }
    if ((event.key === 'Enter' && !event.shiftKey) || (event.key === 'Tab' && people.length)) {
      event.preventDefault(); if (!loading && people[index]) select(people[index]); return true;
    }
    return false;
  }

  return { mentions, open, people, index, listId, loading, error, change, select, reset, onKeyDown,
    close: () => setQuery(null),
    onSelect: (element) => setQuery(mentionQuery(element.value, element.selectionStart, element.selectionEnd, mentions)),
  };
}

export function MentionPicker({ mention }) {
  return <div className="ch-mention-picker"><div className="ch-mention-heading">@ Хэрэглэгч дурдах <small>↑ ↓ · Enter · Esc</small></div>
    <div id={mention.listId} role="listbox" aria-label="Дурдах хэрэглэгч" aria-busy={mention.loading}>
      {mention.people.map((person, index) => <button type="button" role="option" id={`${mention.listId}-${index}`} aria-selected={mention.index === index} tabIndex={-1} key={person.id} onMouseDown={(event) => event.preventDefault()} onClick={() => mention.select(person)}><Avatar person={person} small /><span><PersonName person={person} /><Badges badges={person.badges} /></span></button>)}
    </div>
    {mention.loading ? <p role="status">Хайж байна…</p> : mention.error ? <p role="alert">{mention.error}</p> : !mention.people.length && <p role="status">Тохирох хэрэглэгч алга.</p>}
  </div>;
}
