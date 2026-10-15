import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import MathText from '../components/MathText.jsx';
import { FestiveDecor, WeatherCanvas, WeatherIcon } from '../components/LandingAtmosphere.jsx';
import './Landing.css';

const themes = ['auto', 'clear', 'rain', 'snow', 'newyear'];
const steps = [
  { number: '01', title: 'Шалгалтаа сонго', text: 'Хичээл, жил, хувилбараар нь өмнөх шалгалтуудаас сонгоно.' },
  { number: '02', title: 'Өөрөө бодож ажилла', text: 'Тестийн хариулт сонгох эсвэл математик гараар бодолтоо оруулна.' },
  { number: '03', title: 'Алдаагаа ойлгож давт', text: 'Оноо, зөв хариу, бодолтын тайлбараа харьцуулж, алдсан бодлогоо давтана.' },
];
const features = [
  { number: '01', title: 'Бодит шалгалтын сан', text: 'Өмнөх жилүүдийн улирлын болон явцын шалгалтуудыг хичээл тус бүрээр эмхэтгэсэн.', icon: 'book' },
  { number: '02', title: 'Хоёр төрлөөр ажиллах', text: 'Хугацаатай задгай бодолт эсвэл хугацаагүй тест. Даалгаварт тохирох горимоор бэлдэнэ.', icon: 'write' },
  { number: '03', title: 'Бодолт, үнэлгээний тайлбар', text: 'Зөв хариу, загвар бодолттой харьцуулна. AI үнэлгээ боломжтой үед задгай бодолтын тайлбар авна.', icon: 'spark' },
  { number: '04', title: 'Ахиц чинь нэг дор', text: 'Шалгалтын түүх, сэдэв бүрийн гүйцэтгэлээ харж, дахин давтах хэсгээ олно.', icon: 'chart' },
];
const questions = [
  { title: 'Ямар шалгалтуудад бэлдэж болох вэ?', text: 'Хичээлийн санд байгаа МУИС болон бусад их сургуулийн улирлын, явцын шалгалтуудаар бэлдэнэ. Бүртгэлээрээ нэвтэрч боломжтой хичээл, шалгалтуудыг хараарай.' },
  { title: 'Үнэгүй ажиллаж үзэж болох уу?', text: 'Үнэгүй гэж тэмдэглэсэн шалгалтуудыг бүртгэлээрээ нэвтрээд ажиллаж болно. Бусад шалгалтын эрх, багцын үнийг Төлбөр хэсгээс харна.' },
  { title: 'Утаснаасаа бодлого бодож болох уу?', text: 'Болно. Утас, таблет, компьютерээсээ ашиглаж, задгай хариултыг математик гараар оруулах боломжтой.' },
];

function ArrowIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>;
}
function FeatureIcon({ name }) {
  const paths = { book: 'M4 4h6l2 2 2-2h6v16h-6l-2 2-2-2H4V4Zm8 2v16', write: 'm4 16 12-12 4 4L8 20H4v-4Zm9-9 4 4', spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z', chart: 'M4 4v16h16M8 16v-5m4 5V8m4 8V5' };
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
function isNewYearSeason(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ulaanbaatar', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const month = Number(parts.find((part) => part.type === 'month').value);
  const day = Number(parts.find((part) => part.type === 'day').value);
  return (month === 12 && day >= 15) || (month === 1 && day <= 10);
}
function weatherEffect(code) {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return 'rain';
  return 'clear';
}

function ExampleQuestion() {
  const [answer, setAnswer] = useState(null);
  const correct = answer === 'B';
  return <div className="wa-example" id="example">
    <div className="wa-example__sheet" aria-hidden="true" />
    <div className="wa-example__card">
      <div className="wa-example__top"><span><span className="wa-status-dot" />Өөрийгөө сориорой</span><span className="wa-example__number">01</span></div>
      <div className="wa-example__subject">МАТЕМАТИК / ХЯЗГААР</div>
      <h2>Хязгаарын утгыг олоорой.</h2>
      <div className="wa-example__formula"><MathText text={'$\\displaystyle\\lim_{x\\to 0}\\frac{\\sin(3x)}{\\sin x} = ?$'} /></div>
      <fieldset className="wa-example__choices"><legend className="wa-visually-hidden">Зөв хариултыг сонгоно уу</legend>{[['A', '1'], ['B', '3'], ['C', '0'], ['D', '9']].map(([key, value]) => <label className={'wa-example__choice' + (answer === key ? correct ? ' is-correct' : ' is-incorrect' : '')} key={key}><input type="radio" name="landing-example" value={key} checked={answer === key} onChange={() => setAnswer(key)} /><span className="wa-example__letter">{key}</span><span>{value}</span>{answer === key && <span className="wa-example__mark" aria-hidden="true">{correct ? '✓' : '×'}</span>}</label>)}</fieldset>
      <div className={'wa-example__feedback' + (answer ? ' has-answer' : '')} aria-live="polite">{answer ? <><strong>{correct ? 'Зөв хариуллаа!' : 'Зөв хариулт нь 3.'}</strong><span><MathText text={'$\\sin(ax)/(ax)\\to 1$ тул хязгаарын утга $3$.'} /></span></> : <><FeatureIcon name="write" /><span>Хариултаа сонгоод<br /><strong>бодолтын тайлбарыг хараарай.</strong></span></>}</div>
      <div className="wa-example__foot">Жишээ бодлого · дүнгийн түүхэнд хадгалахгүй</div>
    </div>
    <div className="wa-example__caption"><span />Бод. Шалга. Дахин давт.</div>
  </div>;
}

export default function Landing({ preview = false }) {
  const { user } = useAuth();
  const [adminTheme, setAdminTheme] = useState('auto');
  const [stats, setStats] = useState(null);
  const [weather, setWeather] = useState(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [season, setSeason] = useState(isNewYearSeason);
  const localPreview = import.meta.env.DEV && preview;
  const effect = adminTheme !== 'auto' ? adminTheme : season ? 'newyear' : weather?.effect || 'clear';
  const motionOff = paused || reducedMotion;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    const interval = setInterval(() => setSeason(isNewYearSeason()), 60000);
    return () => { preference.removeEventListener('change', update); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (user && !localPreview) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetch('/api/programs-public', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json(); })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (themes.includes(data.landingTheme)) setAdminTheme(data.landingTheme);
        if (Array.isArray(data.programs)) setStats({ courses: data.programs.length, universities: new Set(data.programs.map((program) => program.universityName).filter(Boolean)).size });
      }).catch(() => {}).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [user, localPreview]);

  useEffect(() => {
    if (user && !localPreview) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=47.9212&longitude=106.918&current=temperature_2m,weather_code&timezone=Asia%2FUlaanbaatar', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!controller.signal.aborted && Number.isFinite(data?.current?.temperature_2m)) setWeather({ temperature: Math.round(data.current.temperature_2m), effect: weatherEffect(data.current.weather_code) });
      }).catch(() => {}).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [user, localPreview]);

  if (user && !localPreview) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/student'} replace />;

  return <div className="landing" data-wtheme={effect} data-motion={motionOff ? 'off' : 'on'}>
    <WeatherCanvas mode={effect} paused={motionOff} />
    <header className="wa-nav"><div className="wa-nav__inner"><Link to="/" className="wa-logo">Work<span>·</span>Ahead<span className="wa-logo__edition">СУРАЛЦАХ ОРОН ЗАЙ</span></Link><nav className="wa-nav__links" aria-label="Танилцуулга"><a href="#how">Хэрхэн ажиллах вэ</a><a href="#features">Боломжууд</a><a href="#faq">Асуулт, хариулт</a></nav><div className="wa-nav__actions"><ThemeToggle compact /><Link to="/login" className="wa-login">Нэвтрэх<ArrowIcon /></Link></div></div></header>
    <main className="wa-main">
      <div className="wa-hero-scene">
        <div className="wa-atmosphere" aria-hidden="true" />
        {effect === 'newyear' && <FestiveDecor />}
        <section className="wa-hero">
          <div className="wa-hero__copy">
            <div className="wa-eyebrow"><span />МУИС · УЛИРЛЫН, ЯВЦЫН ШАЛГАЛТ</div>
            <h1>
              Монгол Улсын Их<br />
              Сургуулийн<br />
              шалгалтад бэлдэж буй<br />
              <span className="wa-h1__accent">оюутнуудад зориулав</span>
            </h1>
            <p className="wa-hero__sub">Өмнөх жилүүдийн бодит шалгалтуудыг ажиллаж, хариугаа шалгаад, ойлгоогүй хэсгээ тайлбартай нь давтаарай.</p>
            <div className="wa-hero__actions"><Link to="/register" className="wa-button wa-button--primary">Бэлтгэлээ эхлүүлэх<ArrowIcon /></Link><a href="#how" className="wa-button wa-button--text">Хэрхэн ажилладаг вэ<span aria-hidden="true">↙</span></a></div>
            <div className="wa-hero__trust"><span>✓ Үнэгүй шалгалтаар эхлэх</span><span>✓ Утаснаасаа ажиллах</span></div>
            <div className="wa-season-status">{effect !== 'clear' && <span className="wa-season-label"><WeatherIcon mode={effect} />{effect === 'newyear' ? 'Шинэ жилийн уур амьсгал' : effect === 'snow' ? 'Цастай өдрийн бэлтгэл' : 'Бороотой өдрийн бэлтгэл'}</span>}{adminTheme === 'auto' && weather && <span className="wa-weather-label">Улаанбаатар · {weather.temperature}°C</span>}{effect !== 'clear' && <button className="wa-motion-control" type="button" aria-pressed={motionOff} disabled={reducedMotion} onClick={() => setPaused((current) => !current)}>{reducedMotion ? 'Хөдөлгөөн багасгасан' : paused ? '▷ Эффект тоглуулах' : 'Ⅱ Эффект зогсоох'}</button>}</div>
          </div>
          <div className="wa-hero__visual"><div className="wa-visual-halo" aria-hidden="true" /><ExampleQuestion /></div>
        </section>
        {(effect === 'snow' || effect === 'newyear') && <div className="wa-snow-edge" aria-hidden="true">{effect === 'snow' ? <svg viewBox="0 0 1200 60" preserveAspectRatio="none"><path d="M0 38 Q 150 10 300 30 T 600 28 T 900 34 T 1200 24 L1200 60 L0 60 Z" fill="currentColor" /></svg> : <svg viewBox="0 0 1440 48" preserveAspectRatio="none"><path d="M0 19Q180 1 360 23T720 20T1080 15T1440 21V48H0Z" fill="currentColor" opacity=".5" /><path d="M0 34Q200 16 400 32T800 31T1200 30L1440 18V48H0Z" fill="currentColor" /></svg>}</div>}
      </div>
      <div className="wa-proof-strip"><span className="wa-proof-strip__label">БЭЛТГЭЛД ЧИНЬ ХЭРЭГТЭЙ БҮХЭН</span><div><span>Бодит шалгалтууд</span><span>Задгай + Тест</span><span>Бодолтын тайлбар</span><span>Сэдвийн ахиц</span></div></div>
      {stats && <section className="wa-stats" aria-label="Хичээлийн сангийн мэдээлэл"><div><strong>{stats.courses}</strong><span>хичээл, хөтөлбөр</span></div><div><strong>{stats.universities}</strong><span>их сургууль</span></div><div><strong>2</strong><span>хариулах горим</span></div></section>}
      <section className="wa-section" id="how"><div className="wa-section__heading"><div><p className="wa-eyebrow">ЭНГИЙН ГУРВАН АЛХАМ</p><h2>Сонго. Бод. Давт.</h2></div><p>Зөвхөн оноогоо харах биш,<br />алдаагаа ойлгож дараагийн удаа зөв бод.</p></div><ol className="wa-steps">{steps.map((step) => <li key={step.number}><span className="wa-step-number">{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol></section>
      <section className="wa-section wa-features-section" id="features"><div className="wa-section__heading"><div><p className="wa-eyebrow">НЭГ ГАЗАР. НЭГ ЗОРИЛГО.</p><h2>Бэлтгэлээ илүү цэгцтэй.</h2></div><p>Ажилласан бодлого, авсан оноо,<br />давтах сэдвүүдээ нэг дор хадгал.</p></div><div className="wa-features">{features.map((feature) => <article className="wa-feature" key={feature.number}><div className="wa-feature__top"><span className="wa-feature__icon"><FeatureIcon name={feature.icon} /></span><span>{feature.number}</span></div><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>
      <section className="wa-section wa-faq" id="faq"><div><p className="wa-eyebrow">АСУУЛТ, ХАРИУЛТ</p><h2>Эхлэхээс өмнө.</h2><p>Өөр асуух зүйл байвал<br /><a href="tel:+97666336691">+976 6633 6691</a></p></div><div>{questions.map((question) => <details key={question.title}><summary>{question.title}<span aria-hidden="true">+</span></summary><p>{question.text}</p></details>)}</div></section>
      <section className="wa-start"><div><p className="wa-eyebrow">ЭХНИЙ ШАЛГАЛТАА СОНГООРОЙ</p><h2>Өөрийнхөө мэдлэгийг<br />шалгаад үзэх үү?</h2><p>Үнэгүй шалгалтаар эхэлж, суралцах хэмнэлээ олоорой.</p></div><Link to="/register" className="wa-button wa-button--primary">Бүртгүүлж эхлэх<ArrowIcon /></Link></section>
    </main>
    <footer className="wa-footer"><div className="wa-footer__main"><div><Link to="/" className="wa-logo">Work<span>·</span>Ahead</Link><p>Оюутны шалгалтын бэлтгэлийн орон зай.</p></div><nav aria-label="Холбоо барих"><Link to="/terms">Үйлчилгээний нөхцөл</Link><a href="tel:+97666336691">+976 6633 6691</a><a href="https://www.facebook.com/profile.php?id=100068091317280" target="_blank" rel="noreferrer">Facebook ↗</a></nav></div><div className="wa-footer__bottom"><span>© {new Date().getFullYear()} WorkAhead</span><div className="wa-pay"><span>Төлбөрийн боломжууд</span><img src="/logos/qpay.avif" alt="QPay" width="40" height="20" /><img src="/logos/socialpay.png" alt="SocialPay" width="62" height="20" /></div></div></footer>
    <div className="landing-ctabar"><Link to="/register" className="wa-button wa-button--primary">Бэлтгэлээ эхлүүлэх<ArrowIcon /></Link><Link to="/login" className="wa-button">Нэвтрэх</Link></div>
  </div>;
}
