import { useEffect, useRef, useState } from 'react';
import { ChatIcon } from './ChatUI.jsx';

const groups = [
  { id: 'smile', name: 'Инээмсэглэл', icon: '😀', keywords: 'face smile happy laugh инээх баяр царай', items: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 🙃 😉 😍 🥰 😘 😎 🤩 🥳 😇 🤔 🫡 🤫 🫠 😴 😭 🥹 😢 😤 😡 🤯 😱 😮 😬 🙄 😏 🤗 🥺 🤓 🧐' },
  { id: 'hands', name: 'Дохио', icon: '👋', keywords: 'hand yes no clap thanks love гар баярлалаа зөв буруу', items: '👋 🤚 ✋ 🖐️ 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 👍 👎 ✊ 👊 🤝 🙌 🫶 👏 🙏 💪 ✍️' },
  { id: 'hearts', name: 'Зүрх & тэмдэг', icon: '❤️', keywords: 'heart love fire star yes check зүрх хайр гал од зөв', items: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 🩷 🩵 💔 💕 💖 💯 🔥 ✨ ⭐ 🌟 💫 ✅ ❌ ❓ ❗ 💬 💭 🎉 🎊' },
  { id: 'study', name: 'Хичээл & ажил', icon: '📚', keywords: 'study book school exam work math хичээл ном шалгалт ажил сургууль бодлого', items: '📚 📖 📕 📗 📘 📓 📝 ✏️ 🖊️ 📐 📏 🧮 🎓 🏆 🥇 🥈 🥉 💻 ⌨️ 📱 💡 ⏰ ⌛ 🎯 🚀 🧠 👀 📌 📎 🔗' },
  { id: 'life', name: 'Өдөр тутам', icon: '🌿', keywords: 'life nature food animal sun moon coffee амьдрал байгаль хоол амьтан нар сар кофе', items: '☀️ 🌙 🌈 ☁️ ❄️ 🌧️ 🌸 🌻 🌿 🍀 🌲 🌍 🐱 🐶 🐼 🦊 🦋 🐝 🍎 🍓 🍕 🍔 🍟 🍜 🍰 🍩 ☕ 🧋 🥤 🎵 🎧 🎮 ⚽ 🏀 🇲🇳' },
];
const allEmoji = groups.flatMap((group) => group.items.split(' '));
const recentKey = 'wa_chat_recent_emoji_v1';

export default function ChatMediaPicker({ mode, onModeChange, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [recent, setRecent] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(recentKey) || '[]');
      return Array.isArray(saved) ? saved.filter((emoji) => allEmoji.includes(emoji)).slice(0, 16) : [];
    } catch { return []; }
  });
  const panel = useRef(null);
  const searchInput = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onPointer = (event) => {
      if (!panel.current?.contains(event.target) && !event.target.closest('[data-chat-media]')) closeRef.current();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (mode === 'emoji') searchInput.current?.focus();
      else panel.current?.querySelector('[aria-pressed="true"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  function choose(emoji) {
    if (onSelect(emoji) === false) return;
    const updated = [emoji, ...recent.filter((item) => item !== emoji)].slice(0, 16);
    setRecent(updated);
    try { localStorage.setItem(recentKey, JSON.stringify(updated)); } catch {}
  }

  const needle = search.trim().toLocaleLowerCase();
  const matchingGroups = groups.filter((group) => (category === 'all' || group.id === category) && (!needle || `${group.name} ${group.keywords} ${group.items}`.toLocaleLowerCase().includes(needle)));

  return <section ref={panel} className="ch-media-picker" role="dialog" aria-label="Emoji ба GIF">
    <header className="ch-media-heading"><div aria-label="Медиа төрөл">{['emoji', 'gif'].map((tab) => <button key={tab} type="button" aria-pressed={mode === tab} onClick={() => onModeChange(tab)}>{tab === 'emoji' ? 'Emoji' : 'GIF'}</button>)}</div><button type="button" className="ch-icon-button" aria-label="Emoji цонх хаах" onClick={onClose}><ChatIcon name="close" size={18} /></button></header>
    {mode === 'gif' ? <div className="ch-gif-soon"><span aria-hidden="true">GIF</span><h3>Тун удахгүй</h3><p>GIF илгээх боломж удахгүй нэмэгдэнэ.</p></div> : <>
      <label className="ch-emoji-search"><ChatIcon name="search" size={17} /><input ref={searchInput} type="search" aria-label="Emoji хайх" value={search} onChange={(event) => { setSearch(event.target.value); setCategory('all'); }} placeholder="Emoji хайх…" /></label>
      <div className="ch-emoji-categories" aria-label="Emoji ангилал"><button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>Бүгд</button>{groups.map((group) => <button key={group.id} type="button" title={group.name} aria-label={group.name} aria-pressed={category === group.id} onClick={() => { setCategory(group.id); setSearch(''); }}>{group.icon}</button>)}</div>
      <div className="ch-emoji-scroll">
        {!needle && category === 'all' && recent.length > 0 && <div className="ch-emoji-group"><h4>СҮҮЛД АШИГЛАСАН</h4><div className="ch-emoji-grid">{recent.map((emoji) => <button type="button" key={emoji} aria-label={emoji} onClick={() => choose(emoji)}>{emoji}</button>)}</div></div>}
        {matchingGroups.map((group) => <div key={group.id} className="ch-emoji-group"><h4>{group.name}</h4><div className="ch-emoji-grid">{group.items.split(' ').map((emoji) => <button type="button" key={emoji} aria-label={emoji} onClick={() => choose(emoji)}>{emoji}</button>)}</div></div>)}
        {!matchingGroups.length && <p className="ch-media-empty">Тохирох emoji олдсонгүй.</p>}
      </div>
      <footer className="ch-media-footer">Сонгоод яриандаа нэмээрэй <span>✦</span></footer>
    </>}
  </section>;
}
