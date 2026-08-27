import { useEffect, useState } from 'react';

export default function ThemeToggle({ compact }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('wa_theme') || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('wa_theme', theme);
  }, [theme]);

  const dark = theme === 'dark';
  return (
    <button
      className={`btn secondary small theme-toggle${compact ? ' icon-only' : ''}`}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Өдрийн горим' : 'Шөнийн горим'}
      title={dark ? 'Өдрийн горим' : 'Шөнийн горим'}
    >
      {compact ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {dark
            ? <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19" /></>
            : <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />}
        </svg>
      ) : (
        dark ? 'Өдрийн горим' : 'Шөнийн горим'
      )}
    </button>
  );
}
