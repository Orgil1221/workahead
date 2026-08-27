import './MobileHeader.css';
import ThemeToggle from './ThemeToggle.jsx';

export default function MobileHeader({ hasUnreadNotifications, onBellClick }) {
  return (
    <header className="mobile-header">
      <div className="mobile-brand">Work<span>·</span>Ahead</div>
      <div className="btn-row" style={{ gap: 6 }}>
        <ThemeToggle compact />
        <button
          className="bell-btn"
          aria-label="Мэдэгдэл"
          onClick={onBellClick}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICONS.bell} />
          </svg>
          {hasUnreadNotifications && <span className="dot-badge" />}
        </button>
      </div>
    </header>
  );
}

const ICONS = {
  bell: 'M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0',
};
