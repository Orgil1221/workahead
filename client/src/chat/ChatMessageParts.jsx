import { useId, useState } from 'react';
import { ChatIcon, PersonName } from './ChatUI.jsx';
import QuestionCard from './QuestionCard.jsx';
import { replySummary, sharedQuestion } from './chatText.js';

export function SharedContent({ body, mentions = [], meId, onPerson }) {
  const question = sharedQuestion(body);
  if (question) return <QuestionCard question={question} />;
  const emojiOnly = /^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200d\ufe0f\s]+$/u.test(body) && Array.from(body).length <= 24;
  const fragments = [];
  let cursor = 0;
  for (const mention of [...mentions].sort((first, second) => first.start - second.start)) {
    if (mention.start < cursor || mention.end <= mention.start || mention.end > body.length || !mention.person) continue;
    fragments.push(body.slice(cursor, mention.start));
    fragments.push(<button type="button" className={'ch-mention' + (mention.userId === meId ? ' ch-mention--me' : '')} key={mention.start} onClick={() => onPerson?.(mention.person)}>{body.slice(mention.start, mention.end)}</button>);
    cursor = mention.end;
  }
  fragments.push(body.slice(cursor));
  return <p className={emojiOnly ? 'ch-emoji-message' : undefined}>{fragments}</p>;
}

export function ReplyPreview({ message, onOpen }) {
  return <button type="button" className="ch-reply-preview" disabled={message.deleted || message.unavailable} onClick={() => onOpen(message)} aria-label="Эх мессеж харах"><ChatIcon name="reply" size={15} />{message.author && <strong><PersonName person={message.author} /></strong>}<span>{replySummary(message)}</span></button>;
}

export function PinnedMessage({ message, userId, admin, busy, onUnpin, onDelete, children }) {
  const storageKey = 'wa_chat_pin_collapsed:v1:' + userId;
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(storageKey) === message.id; } catch { return false; } });
  const bodyId = useId();
  function toggle() {
    setCollapsed(!collapsed);
    try { if (collapsed) localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, message.id); } catch {}
  }
  return <section className={'ch-pin-banner' + (collapsed ? ' ch-pin-banner--collapsed' : '')} aria-label="Тогтоосон мессеж">
    <header><button type="button" className="ch-pin-toggle" aria-expanded={!collapsed} aria-controls={bodyId} aria-label={collapsed ? 'Тогтоосон мессеж дэлгэх' : 'Тогтоосон мессеж хураах'} onClick={toggle}><ChatIcon name="pin" size={16} /><span>ТОГТООСОН МЭДЭГДЭЛ</span><ChatIcon name={collapsed ? 'down' : 'up'} size={16} /></button>
      {admin && <div className="ch-pin-actions"><button type="button" className="ch-icon-button" aria-label="Pin хасах" title="Pin хасах" disabled={busy} onClick={onUnpin}><ChatIcon name="close" size={16} /></button><button type="button" className="ch-icon-button" aria-label="Тогтоосон мессеж устгах" title="Мессеж устгах" disabled={busy} onClick={onDelete}><ChatIcon name="trash" size={16} /></button></div>}
    </header>
    <div id={bodyId} className="ch-pin-body" hidden={collapsed}><small><PersonName person={message.author} /></small>{children}</div>
  </section>;
}
