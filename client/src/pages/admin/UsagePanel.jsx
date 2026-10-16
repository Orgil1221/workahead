import { useState } from 'react';
import { useAdminLoad } from './AdminContext.jsx';
import { AdminEmpty, AdminError, AdminIcon } from './AdminUI.jsx';
import './UsagePanel.css';

export function usageDuration(seconds) {
  if (seconds > 0 && seconds < 60) return '<1 мин';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? hours + ' ц ' + (minutes % 60) + ' мин' : minutes + ' мин';
}
const hourLabel = (hour) => String(hour).padStart(2, '0') + ':00';
const hourRange = (hour) => hourLabel(hour) + '–' + hourLabel((hour + 1) % 24);
const dayLabel = (date) => Number(date.slice(5, 7)) + '/' + Number(date.slice(8));

export default function UsagePanel() {
  const [days, setDays] = useState(7);
  const [view, setView] = useState('daily');
  const [selected, setSelected] = useState(null);
  const { data, error, loading, retry } = useAdminLoad('/admin/usage?days=' + days);
  const points = data?.[view] || [];
  const maximum = Math.max(1, ...points.map((point) => point.seconds || 0));
  const peakIndex = points.reduce((best, point, index) => (point.seconds || 0) > (points[best]?.seconds || 0) ? index : best, Math.max(0, points.findIndex((point) => point.seconds !== null)));
  const inspected = points[selected ?? peakIndex];
  const pointLabel = (point) => view === 'daily' ? dayLabel(point.date) : hourRange(point.hour);

  function changePeriod(value) {
    setDays(value);
    setSelected(null);
    if (value === 1) setView('hourly');
  }
  return <section className="ad-panel ad-usage-panel" aria-label="Оюутны ашиглалтын хугацаа">
    <div className="ad-panel-heading">
      <div><p className="ad-eyebrow">ОЮУТНЫ ИДЭВХ</p><h2>Ашигласан хугацаа <span className="ad-usage-english">Screen Time</span></h2></div>
      <button className="ad-icon-button" aria-label="Ашиглалтын мэдээлэл шинэчлэх" onClick={retry} disabled={loading}><AdminIcon name="refresh" size={18} /></button>
    </div>
    <div className="ad-usage-period" role="group" aria-label="Ашиглалтын хугацааны шүүлтүүр">
      {[[1, 'Өнөөдөр'], [7, '7 хоног'], [30, '30 хоног']].map(([value, title]) => <button key={value} type="button" aria-pressed={days === value} onClick={() => changePeriod(value)}>{title}</button>)}
      <span>УБ · UTC+8</span>
    </div>
    {loading ? <div className="ad-usage-loading" role="status">Хэрэглээний хугацааг ачаалж байна…</div> : error ? <AdminError error={error} retry={retry} /> : <>
      <div className="ad-usage-total"><span>Оюутнуудын нийт хугацаа</span><strong>{usageDuration(data.totalSeconds)}</strong></div>
      <div className="ad-usage-metrics">
        <div><strong>{new Intl.NumberFormat('mn-MN').format(data.activeUsers)}</strong><span>идэвхтэй оюутан</span></div>
        <div><strong>{usageDuration(data.averagePerStudentDaySeconds)}</strong><span>нэг оюутан / идэвхтэй өдөр</span></div>
      </div>
      {!data.trackingSince ? <AdminEmpty title="Хугацааны хэмжилт хараахан эхлээгүй" icon="graduation">Шинэ хэмжилттэй хувилбарыг оюутнууд ашиглаж эхэлмэгц энд мэдээлэл цугларна. Өмнөх хугацааг таамгаар нөхөхгүй.</AdminEmpty> : <>
        <div className="ad-usage-chart-heading"><div role="group" aria-label="Графикийн төрөл">
          {[['daily', 'Өдрөөр'], ['hourly', 'Цагаар']].map(([value, title]) => <button key={value} aria-pressed={view === value} onClick={() => { setView(value); setSelected(null); }}>{title}</button>)}
        </div><span>{view === 'daily' ? 'Өдөр бүрийн нийлбэр' : 'Цаг тус бүрийн нийлбэр'}</span></div>
        <div className="ad-usage-chart" role="group" aria-label={view === 'daily' ? 'Өдөр тутмын ашиглалт' : 'Цагийн ачаалал'}>
          {points.map((point, index) => <button type="button" key={point.date ?? point.hour} disabled={point.seconds === null} className={'ad-usage-column' + ((selected ?? peakIndex) === index ? ' is-inspected' : '') + (point.seconds === null ? ' is-unmeasured' : '')}
            aria-label={pointLabel(point) + ': ' + (point.seconds === null ? 'Хэмжилтгүй' : usageDuration(point.seconds) + ', ' + point.users + ' оюутан') + (point.partial ? ', бүтэн бус өдөр' : '')}
            title={pointLabel(point) + ' · ' + (point.seconds === null ? 'Хэмжилтгүй' : usageDuration(point.seconds))}
            onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)} onClick={() => setSelected(index)}>
            <span className="ad-usage-column-track"><span style={{ height: point.seconds === null ? '100%' : Math.max(2, (point.seconds || 0) / maximum * 100) + '%' }} /></span>
            <span className="ad-usage-tick">{view === 'daily' ? (points.length <= 7 || index % 5 === 0 || index === points.length - 1 ? dayLabel(point.date) : '') : (index % 6 === 0 || index === 23 ? String(point.hour).padStart(2, '0') : '')}</span>
          </button>)}
        </div>
        <div className="ad-usage-detail" aria-live="polite">{inspected && <><strong>{pointLabel(inspected)}</strong><span>{inspected.seconds === null ? 'Хэмжилтгүй' : usageDuration(inspected.seconds) + ' · ' + inspected.users + ' оюутан'}{inspected.partial ? ' · бүтэн бус өдөр' : ''}</span></>}</div>
        {data.peakHour !== null ? <div className="ad-usage-insights"><span>Их ашигладаг <strong>{hourRange(data.peakHour)}</strong></span><span>Бага ашигладаг <strong>{hourRange(data.quietHour)}</strong></span></div> : <p className="ad-panel-footnote">Энэ хугацаанд бүртгэгдсэн идэвхтэй ашиглалт алга.</p>}
      </>}
      <details className="ad-usage-method"><summary>Хугацааг хэрхэн тооцох вэ?</summary><p>Нэвтэрсэн оюутны харагдаж буй, фокустай tab дээрх ашиглалтыг хэмжинэ. 2 минут үйлдэлгүй бол түр зогсоно. Давхар tab, төхөөрөмж дээр давхцсан секундийг нэг удаа тоолно. Админ, landing, preview орохгүй.</p><p>Өдрийн дундаж = нийт хугацаа ÷ идэвхтэй оюутан-өдөр. Цагийн график нь сонгосон хугацааны нийлбэр; өнөөдөр бүтэн бус. Сүлжээ тасрах, браузер шууд хаагдах үед зарим хугацаа бүртгэгдэхгүй байж болно.</p>{data.trackingSince && <p>Хэмжилтийн эхлэл: {new Date(data.trackingSince).toLocaleDateString('mn-MN', { timeZone: data.timezone })}. Түүнээс өмнөх өдрийг “хэмжилтгүй” гэж үзнэ.</p>}</details>
    </>}
  </section>;
}
