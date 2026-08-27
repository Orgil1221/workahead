import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';

export default function StudentDashboard() {
  const [topics, setTopics] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    api('/attempts/progress/topics').then((d) => setTopics(d.topics)).catch(() => {});
    api('/attempts/history/list').then((d) => setAttempts(d.attempts)).catch(() => {});
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  if (!topics) return <Spinner />;

  const scored = attempts.filter((a) => a.totalPoints > 0);
  const pcts = scored.map((a) => Math.round((a.score / a.totalPoints) * 100));
  const avg = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : 0;
  const best = pcts.length ? Math.max(...pcts) : 0;
  const latest = pcts.length ? pcts[0] : 0;

  return (
    <>
      <div className="page-title-row">
        <h1>Явцын дашбоард</h1>
        <Link to="/student/review" className="btn secondary small">Буруу бодсоноо давтах</Link>
      </div>

      {/* Ерөнхий дүрсэлт */}
      <div className="card dash-hero">
        <ProgressRing value={avg} animate={mounted} />
        <div className="dash-stats">
          <div className="dash-stat">
            <span className="dash-stat-value mono">{attempts.length}</span>
            <span className="dash-stat-label">тест өгсөн</span>
          </div>
          <div className="dash-stat">
            <span className="dash-stat-value mono" style={{ color: 'var(--ok)' }}>{best}%</span>
            <span className="dash-stat-label">дээд амжилт</span>
          </div>
          <div className="dash-stat">
            <span className="dash-stat-value mono" style={{ color: 'var(--blue-ink)' }}>{latest}%</span>
            <span className="dash-stat-label">сүүлийн дүн</span>
          </div>
        </div>
      </div>

      {/* Сэдвийн гүйцэтгэл */}
      <h2 className="dash-section-title">Сэдэв тус бүрээр гүйцэтгэл</h2>
      {topics.length === 0 ? (
        <div className="card"><div className="empty-state">
          Одоогоор сэдвийн өгөгдөл байхгүй. Тест өгсний дараа энд харагдана.
        </div></div>
      ) : (
        <div className="card topic-card">
          {topics.map((t) => (
            <div key={t.topic} className="topic-row">
              <div className="topic-head">
                <strong>{t.topic}</strong>
                <span className={`mono topic-pct ${t.percent < 50 ? 'low' : t.percent >= 80 ? 'high' : ''}`}>
                  {t.percent}%
                </span>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill ${t.percent < 50 ? 'low' : t.percent >= 80 ? 'high' : ''}`}
                  style={{ width: mounted ? `${t.percent}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* График — өгөгдөл байхгүй үед ч хэсэг харагдана */}
      <h2 className="dash-section-title">Хугацааны явцын график</h2>
      {scored.length === 0 ? (
        <div className="card"><div className="empty-state">
          Тест дуусгасны дараа онооны график энд үүснэ.<br />
          <Link to="/student" className="small" style={{ color: 'var(--blue-ink)' }}>Шалгалтаа эхлүүлэх →</Link>
        </div></div>
      ) : (
        <ScoreChart attempts={scored.slice().reverse()} animate={mounted} />
      )}
    </>
  );
}

/* Animated circular progress */
function ProgressRing({ value, animate }) {
  const r = 50;
  const C = 2 * Math.PI * r;
  const filled = (animate ? value : 0) / 100 * C;
  return (
    <div className="ring-wrap" role="img" aria-label={`Ерөнхий гүйцэтгэл ${value}%`}>
      <svg viewBox="0 0 120 120" width="128" height="128">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#27427c" />
            <stop offset="100%" stopColor="#a03123" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(216,208,189,.5)" strokeWidth="11" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="url(#ringGrad)" strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${filled} ${C}`}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(.2,.7,.3,1)' }}
        />
      </svg>
      <div className="ring-center">
        <span className="mono ring-value">{value}%</span>
        <span className="ring-label">дундаж</span>
      </div>
    </div>
  );
}

/* Smooth score curve with gradient area */
function ScoreChart({ attempts, animate }) {
  const w = 640, h = 200, padX = 34, padTop = 18, padBottom = 30;
  const pts = attempts.map((a, i) => ({
    x: padX + (i * (w - padX * 2)) / Math.max(attempts.length - 1, 1),
    y: padTop + (1 - (a.totalPoints ? a.score / a.totalPoints : 0)) * (h - padTop - padBottom),
    label: `${a.score}/${a.totalPoints}`,
    date: new Date(a.finishedAt).toLocaleDateString('mn-MN'),
    pct: a.totalPoints ? Math.round((a.score / a.totalPoints) * 100) : 0,
  }));

  const line = pts.map((p, i) => {
    if (!i) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cx = ((prev.x + p.x) / 2).toFixed(1);
    return `C${cx},${prev.y.toFixed(1)} ${cx},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
  const baseY = h - padBottom;
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${baseY} L${pts[0].x.toFixed(1)},${baseY} Z`;

  return (
    <div className="card chart-card">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Онооны график">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#27427c" stopOpacity=".22" />
              <stop offset="100%" stopColor="#27427c" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 50, 100].map((g) => {
            const y = padTop + (1 - g / 100) * (h - padTop - padBottom);
            return (
              <g key={g}>
                <line x1={padX} x2={w - padX / 2} y1={y} y2={y} stroke="rgba(216,208,189,.6)" strokeDasharray={g === 100 ? '' : '3,5'} />
                <text x={4} y={y + 4} fontSize="10" fill="var(--ink-faint)" fontFamily="var(--font-mono)">{g}</text>
              </g>
            );
          })}
          <path d={area} fill="url(#areaGrad)" style={{ opacity: animate ? 1 : 0, transition: 'opacity .8s ease .3s' }} />
          <path d={line} fill="none" stroke="var(--blue-ink)" strokeWidth="2.5" strokeLinecap="round"
            style={{
              strokeDasharray: 2000,
              strokeDashoffset: animate ? 0 : 2000,
              transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.7,.3,1)',
            }} />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="9" fill="transparent" />
              <circle cx={p.x} cy={p.y} r="4.5" fill="#fffdf7" stroke="var(--accent)" strokeWidth="2.5"
                style={{ opacity: animate ? 1 : 0, transition: `opacity .4s ease ${.4 + i * .12}s` }} />
              <title>{`${p.date}: ${p.pct}% (${p.label})`}</title>
            </g>
          ))}
        </svg>
        <p className="faint small" style={{ textAlign: 'center', margin: 0 }}>
          {attempts.length} тест · сүүлийн: {pts[pts.length - 1].pct}% ({pts[pts.length - 1].date})
        </p>
    </div>
  );
}
