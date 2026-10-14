import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildDashboardData, dateLabel, PERIODS, scorePercent } from './dashboardData.js';
import './Dashboard.css';

function Icon({ name, size = 20 }) {
  const paths = {
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    chart: 'M4 19V5m0 14h16M8 14l4-4 4 2 4-7',
    book: 'M12 5v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v14c-4-1-7 0-9 2-2-2-5-3-9-2Z',
    target: 'M20 12a8 8 0 1 1-8-8m4 8a4 4 0 1 1-4-4m0 4 9-9m-5 0h5v5',
    calendar: 'M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 9h2m4 0h2m-8 3h2',
    spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
    clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.chart} /></svg>;
}

function Metric({ label, value, unit, detail, icon, accent }) {
  return (
    <article className={`ld-metric${accent ? ' ld-metric--accent' : ''}`}>
      <div className="ld-metric-heading"><span>{label}</span><Icon name={icon} size={18} /></div>
      <div className="ld-metric-value">{value ?? '—'}{value !== null && unit && <span>{unit}</span>}</div>
      <p>{detail}</p>
    </article>
  );
}

function ScoreChart({ attempts }) {
  const gradientId = useId().replace(/:/g, '');
  const [selected, setSelected] = useState(attempts.length - 1);
  const activeIndex = Math.max(0, Math.min(selected, attempts.length - 1));
  if (!attempts.length) return <div className="ld-chart-empty"><Icon name="chart" size={32} /><strong>Таны эхний цэгийг хүлээж байна</strong><span>Шалгалтаа дуусгахад онооны өөрчлөлт энд харагдана.</span></div>;
  const points = attempts.map((attempt, index) => ({
    attempt,
    percent: scorePercent(attempt),
    horizontal: attempts.length === 1 ? 50 : 4 + index / (attempts.length - 1) * 92,
    vertical: 6 + (100 - scorePercent(attempt)) / 100 * 88,
  }));
  const active = points[activeIndex];
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.horizontal * 6.4} ${point.vertical * 2.2}`).join(' ');
  const area = `${line} L ${points.at(-1).horizontal * 6.4} 220 L ${points[0].horizontal * 6.4} 220 Z`;
  return (
    <>
      <div className="ld-chart-caption" aria-live="polite">
        <span><span className="ld-legend-dot" />Шалгалтын оноо</span>
        <span><strong>{active.percent}%</strong><span className="ld-caption-date"> · {dateLabel(active.attempt.finishedAt)}</span></span>
      </div>
      <div className="ld-chart">
        <div className="ld-chart-axis" aria-hidden="true">{[100, 75, 50, 25, 0].map((value) => <span key={value} style={{ top: `${6 + (100 - value) / 100 * 88}%` }}>{value}</span>)}</div>
        <div className="ld-chart-plot">
          <svg viewBox="0 0 640 220" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--ld-accent)" stopOpacity=".18" /><stop offset="100%" stopColor="var(--ld-accent)" stopOpacity="0" /></linearGradient></defs>
            {[100, 75, 50, 25, 0].map((value) => <line key={value} x1="0" x2="640" y1={(6 + (100 - value) / 100 * 88) * 2.2} y2={(6 + (100 - value) / 100 * 88) * 2.2} stroke="var(--ld-line)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
            {points.length > 1 && <><path d={area} fill={`url(#${gradientId})`} /><path d={line} fill="none" stroke="var(--ld-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></>}
            <line x1={active.horizontal * 6.4} x2={active.horizontal * 6.4} y1="0" y2="220" stroke="var(--ld-accent)" strokeOpacity=".22" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          </svg>
          {points.map((point, index) => <button
            key={point.attempt.id}
            type="button"
            className={`ld-chart-point${index === activeIndex ? ' is-active' : ''}`}
            style={{ left: `${point.horizontal}%`, top: `${point.vertical}%` }}
            aria-label={`${dateLabel(point.attempt.finishedAt)}: ${point.percent}%, ${point.attempt.exam?.title || 'Шалгалт'}`}
            aria-pressed={index === activeIndex}
            onMouseEnter={() => setSelected(index)}
            onFocus={() => setSelected(index)}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const nextIndex = Math.max(0, Math.min(points.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
              event.currentTarget.parentElement.querySelectorAll('button')[nextIndex]?.focus();
            }}
          ><span /></button>)}
        </div>
      </div>
      <div className="ld-chart-dates" aria-hidden="true"><span>{dateLabel(attempts[0].finishedAt)}</span>{attempts.length > 2 && <span>{dateLabel(attempts[Math.floor((attempts.length - 1) / 2)].finishedAt)}</span>}{attempts.length > 1 && <span>{dateLabel(attempts.at(-1).finishedAt)}</span>}</div>
      <div className="ld-chart-detail"><Icon name="book" size={16} /><span>{active.attempt.exam?.title || 'Шалгалт'}</span><strong>{active.attempt.score}/{active.attempt.totalPoints} оноо</strong></div>
    </>
  );
}

function Topics({ topics }) {
  const [expanded, setExpanded] = useState(false);
  const ordered = topics.filter((topic) => Number.isFinite(Number(topic.percent))).map((topic) => ({ ...topic, percent: Math.max(0, Math.min(100, Math.round(Number(topic.percent)))) })).sort((first, second) => first.percent - second.percent);
  return (
    <section className="ld-panel ld-topics">
      <div className="ld-panel-heading"><div><p className="ld-eyebrow">АЛДААНААС АХИЦ РУУ</p><h2>Сэдвийн эзэмшилт</h2></div><span className="ld-icon-box"><Icon name="target" /></span></div>
      <p className="ld-panel-description">Бүх хугацааны дүн · бага оноотой сэдэв эхэнд</p>
      {!ordered.length ? <div className="ld-small-empty">Шалгалт өгсний дараа давтах сэдвүүд тань энд гарна.</div> : <div className="ld-topic-list">{(expanded ? ordered : ordered.slice(0, 5)).map((topic, index) => (
        <div className="ld-topic" key={topic.topic}>
          <div className="ld-topic-label"><span><span className="ld-topic-index">{String(index + 1).padStart(2, '0')}</span>{topic.topic}</span><strong>{topic.percent}%</strong></div>
          <div className="ld-topic-track" role="progressbar" aria-label={topic.topic} aria-valuenow={topic.percent} aria-valuemin={0} aria-valuemax={100}><span className={topic.percent >= 80 ? 'is-strong' : topic.percent >= 50 ? 'is-growing' : ''} style={{ width: `${topic.percent}%` }} /></div>
        </div>
      ))}</div>}
      {ordered.length > 5 && <button type="button" className="ld-text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Хураах' : `Бүх ${ordered.length} сэдвийг харах`} <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>}
      {ordered.length > 0 && <div className="ld-topic-key"><span><i />Давтах</span><span><i />Ахиж буй</span><span><i />Сайн</span></div>}
    </section>
  );
}

export default function DashboardView({ attempts, topics, preview = false, previewNow }) {
  const [period, setPeriod] = useState('30');
  const data = buildDashboardData(attempts, period, previewNow);
  const weakest = topics.slice().sort((first, second) => first.percent - second.percent)[0];
  const hasHistory = attempts.some((attempt) => attempt.finishedAt);
  const activeWeek = data.activity.filter((day) => day.count > 0).length;
  const maxActivity = Math.max(1, ...data.activity.map((day) => day.count));
  const periodLabel = PERIODS.find((item) => item.value === period).label;
  return (
    <div className="learning-dashboard">
      <header className="ld-header">
        <div><p className="ld-eyebrow"><span className="ld-small-mark" /> ТАНЫ СУРАЛЦАХ ТЭМДЭГЛЭЛ</p><h1>Миний ахиц<span>.</span></h1><p className="ld-subtitle">Өчигдрөөс нэг алхам урагш.</p></div>
        <Link className="ld-primary-button" to={preview ? '/register' : '/student'}>Бэлтгэлээ эхлэх <Icon name="arrow" size={18} /></Link>
      </header>

      {!hasHistory && <section className="ld-welcome"><span className="ld-icon-box"><Icon name="spark" size={26} /></span><div><h2>Бүх ахиц эхний оролдлогоос эхэлдэг.</h2><p>Эхний шалгалтаа өгөөд өөрийн давуу тал, давтах сэдвүүдээ олж мэдээрэй.</p></div></section>}

      <div className="ld-toolbar"><div className="ld-section-label"><Icon name="chart" size={17} /><span>Ахицын тойм</span></div><div className="ld-periods" role="group" aria-label="Хугацаа сонгох">{PERIODS.map((item) => <button key={item.value} type="button" aria-pressed={period === item.value} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div></div>

      <section className="ld-metrics" aria-label={`${periodLabel}: үндсэн үзүүлэлтүүд`}>
        <Metric label="Дундаж гүйцэтгэл" value={data.average} unit="%" detail={data.scored.length ? `${data.scored.length} шалгалтын дундаж` : 'Одоогоор үнэлгээ алга'} icon="chart" accent />
        <Metric label="Дуусгасан шалгалт" value={data.filtered.length} detail={period === 'all' ? 'Нийт дуусгасан оролдлого' : `Сүүлийн ${period} хоногт`} icon="book" />
        <Metric label="Хамгийн өндөр оноо" value={data.best} unit="%" detail={data.best === 100 ? 'Төгс гүйцэтгэл. Баяр хүргэе!' : 'Сонгосон хугацааны шилдэг дүн'} icon="target" />
        <Metric label="Идэвхтэй өдөр" value={data.activeDays} unit="өдөр" detail="Шалгалт дуусгасан өдрийн тоо" icon="calendar" />
      </section>

      <div className="ld-main-grid">
        <section className="ld-panel ld-score-panel">
          <div className="ld-panel-heading"><div><p className="ld-eyebrow">ЖИЖИГ АЛХАМ. БОДИТ ӨӨРЧЛӨЛТ.</p><h2>Онооны өөрчлөлт</h2></div>{data.change !== null && <span className={`ld-change${data.change < 0 ? ' is-down' : ''}`}>{data.change > 0 ? '+' : ''}{data.change} нэгж</span>}</div>
          <p className="ld-panel-description">{data.scored.length > 20 ? 'Сонгосон хугацааны сүүлийн 20 шалгалт' : `${periodLabel} · ${data.scored.length} үнэлгээтэй шалгалт`}{data.change !== null && ' · өөрчлөлт нь өмнөх шалгалттай харьцуулсан'}</p>
          <ScoreChart key={period} attempts={data.chartAttempts} />
          {hasHistory && data.filtered.length === 0 && <button className="ld-text-button" type="button" onClick={() => setPeriod('all')}>Бүх хугацааны дүнг харах <Icon name="arrow" size={16} /></button>}
        </section>
        <Topics topics={topics} />
      </div>

      <div className="ld-bottom-grid">
        <section className="ld-panel ld-history">
          <div className="ld-panel-heading"><div><p className="ld-eyebrow">ТАНЫ ХИЙСЭН АЖИЛ</p><h2>Сүүлийн шалгалтууд</h2></div>{!preview && <Link className="ld-text-link" to="/student/history">Бүгд <Icon name="arrow" size={16} /></Link>}</div>
          {data.recent.length === 0 ? <div className="ld-small-empty">Энэ хугацаанд дуусгасан шалгалт алга.</div> : <div className="ld-recent-list">{data.recent.map((attempt) => {
            const percent = scorePercent(attempt);
            const content = <><span className="ld-attempt-icon"><Icon name={attempt.mode === 'TEST' ? 'target' : 'book'} size={19} /></span><span className="ld-attempt-info"><strong>{attempt.exam?.title || 'Шалгалт'}</strong><span>{dateLabel(attempt.finishedAt)} <span aria-hidden="true">·</span> {attempt.mode === 'TEST' ? 'Тест' : 'Задгай бодлого'}</span></span><span className={`ld-attempt-score${percent >= 80 ? ' is-strong' : ''}`}><strong>{percent === null ? '—' : `${percent}%`}</strong><span>{attempt.score}/{attempt.totalPoints} оноо</span></span>{!preview && <Icon name="arrow" size={16} />}</>;
            return preview ? <div className="ld-attempt" key={attempt.id}>{content}</div> : <Link className="ld-attempt" key={attempt.id} to={`/student/attempt/${attempt.id}`}>{content}</Link>;
          })}</div>}
        </section>

        <section className="ld-panel ld-activity">
          <div className="ld-panel-heading"><div><p className="ld-eyebrow">ТОГТМОЛ БАЙДАЛ ЧУХАЛ</p><h2>Бэлтгэлийн хэмнэл</h2></div><Icon name="calendar" /></div>
          <p className="ld-panel-description">Сүүлийн 7 хоногт <strong>{activeWeek} өдөр</strong> бэлтгэл хийжээ.</p>
          <div className="ld-week" role="list" aria-label="Сүүлийн долоо хоногийн дуусгасан шалгалтууд">{data.activity.map((day, index) => <div className={`ld-day${index === 6 ? ' is-today' : ''}`} key={day.date.toISOString()} role="listitem" aria-label={`${dateLabel(day.date)}: ${day.count} шалгалт${index === 6 ? ', өнөөдөр' : ''}`}><span className="ld-day-count">{day.count || '·'}</span><div className="ld-day-track"><span style={{ height: day.count ? `${Math.max(12, day.count / maxActivity * 100)}%` : '4px' }} className={day.count ? 'has-activity' : ''} /></div><span className="ld-day-label">{day.label}</span></div>)}</div>
          <div className="ld-week-note"><span className="ld-today-dot" /> Өнөөдөр <span>Нэг багана = нэг өдөр</span></div>
        </section>
      </div>

      <section className="ld-next-step"><span className="ld-next-icon"><Icon name="spark" size={24} /></span><div><p className="ld-eyebrow">ДАРААГИЙН ЖИЖИГ АЛХАМ</p><h2>{weakest && weakest.percent < 80 ? `${weakest.topic} сэдвээ дахин нэг давтаарай.` : 'Өнөөдрийн бэлтгэлээ нэг бодлогоос эхлүүлээрэй.'}</h2><p>{weakest && weakest.percent < 80 ? 'Алдсан бодлогоо ойлгож бодох нь дараагийн ахицын эхлэл.' : 'Тогтмол хийсэн багахан бэлтгэл том өөрчлөлт авчирна.'}</p></div><Link className="ld-next-link" to={preview ? '/register' : weakest && weakest.percent < 80 ? '/student/review' : '/student'}>{weakest && weakest.percent < 80 ? 'Алдаагаа давтах' : 'Хичээл сонгох'} <Icon name="arrow" size={18} /></Link></section>
      <p className="ld-footnote">Таны ахиц бусдынхтай биш, өөрийн өмнөх оролдлоготой харьцуулагдана.</p>
    </div>
  );
}
