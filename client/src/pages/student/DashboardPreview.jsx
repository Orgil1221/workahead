import { useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import DashboardView from './DashboardView.jsx';

function makePreviewAttempts(now) {
  const scores = [42, 54, 48, 62, 58, 70, 66, 76, 72, 82, 78, 88];
  const daysAgo = [26, 23, 21, 18, 15, 12, 9, 6, 4, 2, 1, 0];
  const titles = ['Математик 1Б — Явцын шалгалт', 'Математик 1Б — Улирлын шалгалт', 'Магадлалын онол — Явцын шалгалт'];
  return scores.map((score, index) => {
    const finished = new Date(now);
    finished.setDate(finished.getDate() - daysAgo[index]);
    finished.setHours(9, 15, 0, 0);
    if (finished > now) finished.setTime(now.getTime() - 60000);
    return {
      id: 'preview-' + index,
      mode: index % 3 === 0 ? 'TIMED' : 'TEST',
      score: score / 2,
      totalPoints: 50,
      finishedAt: finished.toISOString(),
      exam: { title: titles[index % titles.length] },
    };
  });
}

const previewTopics = [
  { topic: 'Интеграл', percent: 42 },
  { topic: 'Хязгаар', percent: 64 },
  { topic: 'Магадлал', percent: 71 },
  { topic: 'Уламжлал', percent: 86 },
  { topic: 'Матриц', percent: 92 },
  { topic: 'Вектор', percent: 95 },
];

export default function DashboardPreview() {
  const [scenario, setScenario] = useState('populated');
  const [now] = useState(() => new Date());
  const attempts = scenario === 'empty' ? [] : makePreviewAttempts(now);
  return (
    <>
      <div className="ld-preview-bar">
        <div><strong>Дашбоардын урьдчилсан харагдац</strong><span>Жишээ өгөгдөл · бодит суралцагчийн дүн биш</span></div>
        <div><label htmlFor="preview-scenario">Төлөв</label><select id="preview-scenario" value={scenario} onChange={(event) => setScenario(event.target.value)}><option value="populated">Ахицтай суралцагч</option><option value="empty">Шинэ суралцагч</option></select><ThemeToggle compact /></div>
      </div>
      <div className="app-shell ld-preview-shell">
        <aside className="sidebar">
          <Link className="brand" to="/" style={{ color: 'inherit', textDecoration: 'none' }}>Work<span>·</span>Ahead</Link>
          <div className="nav-section">Суралцах орон зай</div>
          <Link className="nav-item" to="/">Нүүр хуудас</Link>
          <Link className="nav-item active" to="/preview/dashboard" aria-current="page">Миний ахиц</Link>
          <Link className="nav-item" to="/login">Миний бүртгэлээр нэвтрэх</Link>
          <p className="ld-preview-footer">Бага багаар.<br />Өдөр бүр урагш.</p>
        </aside>
        <div className="main-col"><main className="content dashboard-content"><DashboardView key={scenario} attempts={attempts} topics={scenario === 'empty' ? [] : previewTopics} preview previewNow={now} /></main></div>
      </div>
    </>
  );
}
