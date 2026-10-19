import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import DashboardView from './DashboardView.jsx';
import { NavLink } from 'react-router-dom';
import History from './History.jsx';
import '../../chat/Chat.css';

function DashboardData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [request, setRequest] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setData(null);
    Promise.all([api('/attempts/progress/topics'), api('/attempts/history/list')])
      .then(([topicData, attemptData]) => {
        if (!Array.isArray(topicData.topics) || !Array.isArray(attemptData.attempts)) {
          throw new Error('Дүнгийн мэдээлэл бүрэн ирсэнгүй. Дахин оролдоно уу.');
        }
        if (!cancelled) setData({ topics: topicData.topics, attempts: attemptData.attempts });
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message || 'Мэдээлэл ачаалж чадсангүй.');
      });
    return () => { cancelled = true; };
  }, [request]);

  if (error) return (
    <div className="learning-dashboard">
      <section className="ld-error" role="alert">
        <h1>Ахицын мэдээлэл ачаалсангүй</h1>
        <p>{error}</p>
        <button type="button" className="ld-primary-button" onClick={() => setRequest((value) => value + 1)}>Дахин оролдох</button>
      </section>
    </div>
  );

  if (!data) return (
    <div className="learning-dashboard ld-loading" role="status" aria-label="Ахицын мэдээлэл ачаалж байна">
      <span />
      <div className="ld-metrics" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className="ld-metric" key={index} />)}</div>
      <div className="ld-main-grid" aria-hidden="true"><div className="ld-panel" /><div className="ld-panel" /></div>
    </div>
  );

  return <DashboardView {...data} />;
}

export default function StudentDashboard({ history = false }) {
  return <><nav className="progress-switch" aria-label="Ахицын хэсгүүд"><NavLink to="/student/dashboard" end>Миний ахиц</NavLink><NavLink to="/student/dashboard/history">Дүнгийн түүх</NavLink></nav>{history ? <History /> : <DashboardData />}</>;
}
