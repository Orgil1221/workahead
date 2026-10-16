import { AdminLink, useAdminLoad } from './AdminContext.jsx';
import UsagePanel from './UsagePanel.jsx';
import { AdminEmpty, AdminError, AdminHeading, AdminIcon, AdminSkeleton } from './AdminUI.jsx';

const number = (value) => new Intl.NumberFormat('mn-MN').format(value ?? 0);

export default function AdminDashboard() {
  const { data: stats, loading, error, retry } = useAdminLoad('/admin/stats');
  if (loading) return <><AdminHeading eyebrow="ЕРӨНХИЙ ТОЙМ" title="Хяналтын самбар" description="Суралцах орон зайн өнөөгийн дүр зураг." /><AdminSkeleton /></>;
  if (error) return <><AdminHeading title="Хяналтын самбар" /><AdminError error={error} retry={retry} /></>;
  const totals = stats.totals;
  const conversion = totals.users ? Math.min(100, Math.max(0, Math.round((totals.activePaid || 0) / totals.users * 100))) : 0;
  const circumference = 2 * Math.PI * 49;
  const metrics = [
    { label: 'Нийт хэрэглэгч', value: totals.users, icon: 'users', note: 'Бүртгэлтэй бүх хэрэглэгч', to: '/admin/users' },
    { label: 'Шалгалтын оролдлого', value: totals.attempts, icon: 'graduation', note: 'Нийт хугацаанд ажилласан', to: '/admin/catalog' },
    { label: 'Асуултын сан', value: totals.questions, icon: 'book', note: 'Бэлтгэлд ашиглах асуулт', to: '/admin/questions' },
    { label: 'Шийдвэрлэх мэдээлэл', value: totals.newFlags, icon: 'flag', note: 'Шинэ төлөвтэй алдааны мэдээлэл', to: '/admin/reports', alert: totals.newFlags > 0 },
  ];
  return <>
    <AdminHeading eyebrow="ЕРӨНХИЙ ТОЙМ" title="Хяналтын самбар" description="Суралцах орон зайн өнөөгийн дүр зураг."><button className="btn secondary small" onClick={retry}><AdminIcon name="refresh" size={16} />Шинэчлэх</button><AdminLink className="btn small" to="/admin/import"><AdminIcon name="upload" size={17} />Контент нэмэх</AdminLink></AdminHeading>
    <div className="ad-overview-note"><span className="ad-live-dot" /><span>Бүх хугацааны нэгтгэл</span><span>Өмнөх үетэй харьцуулсан өөрчлөлт биш</span></div>
    <div className="ad-kpi-grid">{metrics.map((metric) => <AdminLink to={metric.to} key={metric.label} className={'ad-kpi' + (metric.alert ? ' ad-kpi--alert' : '')}><div><span>{metric.label}</span><span className="ad-kpi-icon"><AdminIcon name={metric.icon} size={19} /></span></div><strong>{number(metric.value)}</strong><footer><span>{metric.note}</span><AdminIcon name="arrow" size={16} /></footer></AdminLink>)}</div>
    <div className="ad-overview-grid">
      <section className="ad-panel"><div className="ad-panel-heading"><div><p className="ad-eyebrow">СУРАЛЦАХ ЭРХ</p><h2>Төлбөрт хэрэглэгчдийн эзлэх хувь</h2></div><AdminIcon name="card" /></div><div className="ad-access-overview"><div className="ad-donut" role="img" aria-label={'Нийт хэрэглэгчийн ' + conversion + '% нь идэвхтэй төлбөрт эрхтэй'}><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="49" className="ad-donut-track" /><circle cx="60" cy="60" r="49" className="ad-donut-value" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - conversion / 100)} /></svg><div><strong>{conversion}<small>%</small></strong><span>идэвхтэй төлбөрт</span></div></div><div className="ad-access-counts"><div><span><i />Төлбөрт эрхтэй</span><strong>{number(totals.activePaid)}</strong><small>Нийт төлбөр төлсөн: {number(totals.paidUsers)}</small></div><div><span><i className="ad-gift-dot" />Бэлгийн эрхтэй</span><strong>{number(totals.activeGift)}</strong><small>Нийт бэлгийн эрх авсан: {number(totals.giftUsers)}</small></div></div></div><p className="ad-panel-footnote">Одоо хүчинтэй эрхийг харуулна. Нэг хүн хоёр төрөлд давхар тоологдож болох тул нийлбэрийг нийт хэрэглэгч гэж үзэхгүй.</p><AdminLink className="ad-text-link" to="/admin/settings">Багцын тохиргоо<AdminIcon name="arrow" size={16} /></AdminLink></section>
      <UsagePanel />
    </div>
    <section className="ad-panel ad-review-panel"><div className="ad-panel-heading"><div><p className="ad-eyebrow">КОНТЕНТЫН ХЯНАЛТ</p><h2>Мэдээлэл ирсэн асуултууд</h2></div><AdminLink className="ad-text-link" to="/admin/reports">Бүгдийг харах<AdminIcon name="arrow" size={16} /></AdminLink></div>{stats.mostFlagged.length ? <div className="ad-review-list">{stats.mostFlagged.map((question) => <AdminLink key={question.id} to={'/admin/questions?q=' + encodeURIComponent(question.id)} className="ad-review-row"><span className="ad-review-icon"><AdminIcon name="flag" size={18} /></span><div><span>{question.exam?.title || 'Шалгалт'}</span><strong>{question.prompt.replace(/\$[^$]*\$/g, ' [бодлого] ').slice(0, 140)}</strong></div><span className="ad-report-count">{number(question._count.flags)} мэдээлэл</span><AdminIcon name="chevron" size={17} /></AdminLink>)}</div> : <AdminEmpty title="Мэдээлэл ирсэн асуулт алга" icon="check">Оюутнуудын илгээсэн алдааны мэдээлэл энд цугларна.</AdminEmpty>}<p className="ad-panel-footnote">Нийт ирсэн мэдээллийн тоогоор эрэмбэлсэн. Шийдвэрлэсэн мэдээлэл мөн багтана.</p></section>
    <div className="ad-quick-links">{[{ to: '/admin/catalog', title: 'Хичээл, шалгалт', description: 'Сургалтын сангаа эмхэтгэ', icon: 'catalog' }, { to: '/admin/notify', title: 'Мэдэгдэл илгээх', description: 'Оюутнуудтайгаа холбогд', icon: 'bell' }, { to: '/admin/settings', title: 'Landing ба багцууд', description: 'Сайтын харагдац, эрхийн тохиргоо', icon: 'settings' }].map((item) => <AdminLink className="ad-quick-link" to={item.to} key={item.to}><span><AdminIcon name={item.icon} /></span><div><strong>{item.title}</strong><small>{item.description}</small></div><AdminIcon name="arrow" size={17} /></AdminLink>)}</div>
  </>;
}
