import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import './Landing.css';

/* ---------- helpers ---------- */

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Eases a number from 0 to `target` over `duration` ms, calling `onTick` each frame.
function runCountUp(target, duration, onTick) {
  if (target <= 0) {
    onTick(0);
    return () => {};
  }
  if (prefersReducedMotion()) {
    onTick(target);
    return () => {};
  }
  let raf;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    onTick(Math.round(eased * target));
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/* ---------- Улаанбаатарын цаг агаар → theme ---------- */

const UB_LAT = 47.9212;
const UB_LON = 106.918;

// Open-Meteo weather_code → бороо / цас / null (энгийн)
function codeToFx(code) {
  if (code == null) return null;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return 'rain';
  return null;
}

// Шинэ жилийн улирал: 12-15 … 01-10
function isNewYearSeason(d = new Date()) {
  const m = d.getMonth();
  const day = d.getDate();
  return (m === 11 && day >= 15) || (m === 0 && day <= 10);
}

// Canvas бороо/цас — БҮТЭН ДЭЛГЭЦ (fixed), контентын ард, pointer-eventsгүй.
// Бодит харагдуулахын тулд: бороо 2 давхарга (хол/ойр) + салхины шуурга,
// цас 3 давхарга (жижиг удаан бүдэг + том хурдан тод) + сэвэлзэх хөдөлгөөн.
function WeatherFx({ mode }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || (mode !== 'rain' && mode !== 'snow')) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let W = 0;
    let H = 0;
    let t = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.max(1, W * dpr);
      canvas.height = Math.max(1, H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const isRain = mode === 'rain';
    const rnd = (a, b) => a + Math.random() * (b - a);
    const density = Math.max(0.5, Math.min(1.3, (W * H) / 1000000));
    const layers = isRain ? [
      { n: Math.floor(80 * density), sp: [7, 10], len: [8, 14], w: 1, col: 'rgba(105,145,200,0.22)' },
      { n: Math.floor(80 * density), sp: [12, 19], len: [15, 27], w: 1.4, col: 'rgba(105,145,200,0.5)' },
    ] : [
      { n: Math.floor(50 * density), r: [0.8, 1.7], sp: [0.35, 0.8], col: 'rgba(160,180,210,0.5)' },
      { n: Math.floor(40 * density), r: [1.6, 2.7], sp: [0.7, 1.4], col: 'rgba(160,180,210,0.75)' },
      { n: Math.floor(25 * density), r: [2.4, 4], sp: [1.2, 2.1], col: 'rgba(170,190,220,0.95)' },
    ];
    for (const L of layers) {
      L.ps = Array.from({ length: L.n }, () => ({
        x: rnd(0, W), y: rnd(0, H), ph: rnd(0, Math.PI * 2),
        r: L.r ? rnd(...L.r) : 0, len: L.len ? rnd(...L.len) : 0,
        sp: rnd(...L.sp), drift: isRain ? rnd(-2.5, -1) : rnd(-0.4, 0.4),
      }));
    }
    const step = () => {
      t += 16;
      // Салхины шуурга — үе үе чиглэл хурд өөрчлөгдөнө
      const gust = Math.sin(t * 0.0004) * 1.6 + Math.sin(t * 0.0013) * 0.7;
      ctx.clearRect(0, 0, W, H);
      for (const L of layers) {
        if (isRain) {
          ctx.strokeStyle = L.col;
          ctx.lineWidth = L.w;
          ctx.beginPath();
          for (const p of L.ps) {
            p.y += p.sp;
            p.x += p.drift + gust;
            if (p.y > H + 28) { p.y = -28; p.x = rnd(0, W); }
            if (p.x < -28) p.x = W + 28;
            if (p.x > W + 28) p.x = -28;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.drift + gust * 0.6, p.y + p.len);
          }
          ctx.stroke();
        } else {
          ctx.fillStyle = L.col;
          for (const p of L.ps) {
            p.ph += 0.008 + p.sp * 0.004;
            p.y += p.sp;
            p.x += p.drift + Math.sin(p.ph) * 0.5 + gust * 0.35;
            if (p.y > H + 8) { p.y = -8; p.x = rnd(0, W); }
            if (p.x < -8) p.x = W + 8;
            if (p.x > W + 8) p.x = -8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(step);
    };
    if (prefersReducedMotion()) {
      // Хөдөлгөөн хориотой үед 1 статикт кадр (хоосон биш)
      t = 5000;
      for (const L of layers) {
        if (isRain) {
          ctx.strokeStyle = L.col; ctx.lineWidth = L.w; ctx.beginPath();
          for (const p of L.ps) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.drift, p.y + p.len); }
          ctx.stroke();
        } else {
          ctx.fillStyle = L.col;
          for (const p of L.ps) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    } else {
      raf = requestAnimationFrame(step);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [mode]);
  if (mode !== 'rain' && mode !== 'snow') return null;
  return <canvas ref={ref} className="wfx" aria-hidden="true" />;
}

// Санта малгай (SVG) — шинэ жилийн theme-ээр хэдэн газар өлгөгдөнө
function SantaHat({ className = '' }) {
  return (
    <svg className={`santa-hat ${className}`} viewBox="0 0 48 48" aria-hidden="true">
      {/* Конус — зүүн доороос дээш баруун орой руу */}
      <path
        d="M9 34 C12 21 24 9 38 11 C35 14 32 16 29 19 C24 23 22 28 22 34 Z"
        fill="#d22630"
      />
      {/* Сүүдэр — гүн мэдрэмж */}
      <path
        d="M9 34 C12 21 24 9 38 11 L36 13 C24 12 14 22 12 34 Z"
        fill="#a31621"
        opacity="0.45"
      />
      {/* Цагаан зах */}
      <rect x="5" y="32.5" width="30" height="9.5" rx="4.75" fill="#ffffff" stroke="#e2ddd2" strokeWidth="1" />
      {/* Бөмбөлөг */}
      <circle cx="38.5" cy="12" r="5.2" fill="#ffffff" stroke="#e2ddd2" strokeWidth="1" />
    </svg>
  );
}

const MARQUEE_WORDS = [
  'Улирлын шалгалт',
  'Явцын шалгалт',
  'Задгай даалгавар',
  'Тест',
  'AI үнэлгээ',
  'Иж бүрэн бодолт',
];

const STEPS = [  {
    n: '1',
    title: 'Шалгалтаа сонго',
    body: 'Их сургууль, хичээл, улирлын эсвэл явцын шалгалтаараа шүүж, бодит даалгавраа ол.',
  },
  {
    n: '2',
    title: 'Бодож хариул',
    body: 'Тестээр эсвэл математик гарын тусламжтай задгай бодолтоор өөрийн хариултаа бич.',
  },
  {
    n: '3',
    title: 'Үнэлгээ, шийдэл хар',
    body: 'AI шууд оноо, тайлбар өгнө. Дараа нь бүрэн загвар бодолттой харьцуулж ал.',
  },
];

const FEATURES = [
  {
    title: 'Бодит шалгалтууд',
    body: 'Өмнөх улирлуудын жинхэнэ дундаж болон улирлын шалгалтын даалгаврууд, сургууль тус бүрээр эмхэтгэсэн.',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="7" y="4" width="18" height="24" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 11h10M11 15.5h10M11 20h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Задгай + Тест',
    body: 'Даалгавар бүрийг хүссэн горимоороо бод: гараар бичсэн бодолт эсвэл 4 сонголттой тест.',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="11" cy="16" r="5.2" stroke="currentColor" strokeWidth="1.6" />
        <rect x="18" y="10.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M21.2 16h4.6M23.5 13.7v4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'AI автомат үнэлгээ',
    body: 'Задгай бодолтыг секундын дотор оноож, монголоор тайлбар өгнө — багшийн хариу хүлээх шаардлагагүй.',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M16 5.5l2.3 5.6 5.9.6-4.4 4 1.3 5.8-4.6-3.2L11 6.2z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M7 24l1.3-3M25 24l-1.3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Сэдвийн ахиц',
    body: 'Сэдэв тус бүрээр авьяас, дутагдалтай хэсгээ ил хар. Оноо, түүхээ хадгалж, дараагийн шалгалтдаа бэлдэнэ.',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M6 25V15M14 25V9M22 25v-6M26 25H4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/* ---------- component ---------- */

export default function Landing() {
  const { user } = useAuth();

  const [stats, setStats] = useState(null); // { courses, universities } | null
  const [statsFailed, setStatsFailed] = useState(false);
  const [courseCount, setCourseCount] = useState(0);
  const [uniCount, setUniCount] = useState(0);

  // Цаг агаар theme — админ удирддаг (admin/settings/landing-theme).
  // Landing дээрх selector хасагдсан; зочин зөвхөн харна.
  const [adminTheme, setAdminTheme] = useState('auto');
  const [wx, setWx] = useState(null); // { temp, fx } | null — Open-Meteo Улаанбаатар

  const statsRef = useRef(null);
  const statsCountedRef = useRef(false);
  const revealRefs = useRef([]);

  // Үр дүнгийн theme: admin(auto/..) → auto бол УБ цаг агаар / шинэ жил улирал
  const wtheme = adminTheme || 'auto';

  // Улаанбаатарын realtime цаг агаар (Open-Meteo, түлхүүр шаардлагагүй)
  useEffect(() => {
    let cancelled = false;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${UB_LAT}&longitude=${UB_LON}&current=temperature_2m,weather_code&timezone=Asia%2FUlaanbaatar`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.current) return;
        setWx({ temp: Math.round(d.current.temperature_2m), fx: codeToFx(d.current.weather_code) });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Үр дүнгийн theme: manual > auto(шинэ жил улирал > цаг агаар > энгийн)
  const eff = wtheme !== 'auto' ? wtheme : (isNewYearSeason() ? 'newyear' : (wx?.fx || 'clear'));
  const fx = eff === 'newyear' ? 'snow' : eff === 'rain' || eff === 'snow' ? eff : null;

  // Public stats + админы theme — plain fetch, never the app's api() helper (it redirects on 401).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/programs-public')
      .then((res) => {
        if (!res.ok) throw new Error('programs-public failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.landingTheme) setAdminTheme(data.landingTheme);
        const programs = Array.isArray(data?.programs) ? data.programs : [];
        if (programs.length === 0) throw new Error('empty');
        const universities = new Set(programs.map((p) => p.universityName).filter(Boolean));
        setStats({ courses: programs.length, universities: universities.size });
      })
      .catch(() => {
        if (!cancelled) setStatsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Count-up once the stats row scrolls into view.
  useEffect(() => {
    if (!stats || !statsRef.current) return;
    const el = statsRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !statsCountedRef.current) {
            statsCountedRef.current = true;
            runCountUp(stats.courses, 900, setCourseCount);
            runCountUp(stats.universities, 900, setUniCount);
            io.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stats]);

  // Generic scroll-reveal for sections.
  const registerReveal = useCallback((el) => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  }, []);

  useEffect(() => {
    const els = revealRefs.current;
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Нэвтэрсэн хэрэглэгч landing харахгүй — бүх hook-ийн дараа (hook дараалал алдагдахгүй)
  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/student'} replace />;
  }

  return (
    <div className="landing" data-wtheme={eff}>
      <WeatherFx mode={fx} />
      {/* 1. Navbar */}
      <header className="wa-nav">
        <div className="wa-nav__inner">
          <span className="wa-logo">
            {eff === 'newyear' && <SantaHat className="on-logo" />}
            Work<span className="wa-logo__dot">·</span>Ahead
          </span>
          <div className="wa-nav__actions">
            <ThemeToggle compact />
            <Link to="/login" className="btn ghost">
              Нэвтрэх
            </Link>
            <Link to="/register" className="btn primary">
              Бүртгүүлэх
            </Link>
          </div>
        </div>
        {eff === 'newyear' && (
          <div className="xmas-lights" aria-hidden="true">
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} className={`bulb b${i % 4}`} style={{ animationDelay: `${(i % 7) * 0.35}s` }} />
            ))}
          </div>
        )}
      </header>

      <main>
        {/* 2. Hero */}
        <section className="wa-hero">
          <div className="wa-hero__grid">
            <div className="wa-hero__copy">
              <span className="pill">Улирлын · Явцын шалгалт</span>
              {wtheme === 'auto' && wx && (
                <span className="pill wx-pill">УБ: {wx.temp}°C{wx.fx === 'rain' ? ' · Бороо' : wx.fx === 'snow' ? ' · Цас' : ''}</span>
              )}
              <h1 className="wa-h1">
                Монгол Улсын Их
                <br />
                Сургуулийн
                <br />
                шалгалтад бэлдэж буй
                <br />
                <span className="wa-h1__accent">оюутнуудад зориулав</span>
              </h1>
              <p className="wa-hero__sub">
                МУИС болон Монголын их сургуулиудын жинхэнэ улирлын, явцын шалгалтын
                бодлогуудыг бод, AI-аас шууд үнэлгээ, тайлбар аваад шалгалтын бэлтгэлээ хурдасга.
              </p>
            </div>

            <div className="wa-hero__visual" aria-hidden="true">
              <div className="wa-orb wa-orb--blue" />
              <div className="wa-orb wa-orb--red" />

              <span className="wa-chip wa-chip--1">Тест</span>
              <span className="wa-chip wa-chip--2">Задгай</span>
              <span className="wa-chip wa-chip--3">AI үнэлгээ</span>

              <div className="wa-card">
                {eff === 'newyear' && <SantaHat className="on-card" />}
                <div className="wa-card__top">
                  <span className="wa-card__tag">МУИС · Магадлалын онол</span>
                  <span className="wa-card__timer">12:34</span>
                </div>
                <p className="wa-card__question">∫₀² (3x² + 2x) dx = ?</p>
                <div className="wa-card__options">
                  <div className="wa-card__opt">
                    <span className="wa-card__radio" />A. 12
                  </div>
                  <div className="wa-card__opt wa-card__opt--correct">
                    <span className="wa-card__radio wa-card__radio--ok" />
                    B. 16
                    <svg className="wa-check" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="wa-card__opt">
                    <span className="wa-card__radio" />C. 18
                  </div>
                  <div className="wa-card__opt">
                    <span className="wa-card__radio" />D. 20
                  </div>
                </div>
                <div className="wa-stamp">
                  <span className="wa-stamp__num">96</span>
                  <span className="wa-stamp__label">ШАЛГАСАН</span>
                </div>
              </div>
            </div>
          </div>
          {(eff === 'snow' || eff === 'newyear') && (
            <div className="snowbank" aria-hidden="true">
              <svg viewBox="0 0 1200 60" preserveAspectRatio="none">
                <path d="M0 38 Q 150 10 300 30 T 600 28 T 900 34 T 1200 24 L1200 60 L0 60 Z" fill="currentColor" />
              </svg>
            </div>
          )}
        </section>

        {/* 3. Marquee */}
        <div className="wa-marquee" role="presentation">
          <div className="wa-marquee__track">
            {[...MARQUEE_WORDS, ...MARQUEE_WORDS, ...MARQUEE_WORDS, ...MARQUEE_WORDS].map((w, i) => (
              <span className="wa-marquee__item" key={i}>
                {w}
              </span>
            ))}
          </div>
        </div>

        {/* 4. Stats */}
        {!statsFailed && stats && (
          <section className="wa-stats" ref={statsRef}>
            <div className="wa-stats__inner">
              <div className="wa-stat">
                <span className="wa-stat__num">{courseCount}</span>
                <span className="wa-stat__label">хичээл, хөтөлбөр</span>
              </div>
              <div className="wa-stat">
                <span className="wa-stat__num">{uniCount}</span>
                <span className="wa-stat__label">их сургууль</span>
              </div>
              <div className="wa-stat">
                <span className="wa-stat__num">2</span>
                <span className="wa-stat__label">хариулах горим</span>
              </div>
            </div>
          </section>
        )}

        {/* 5. How it works */}
        <section className="wa-section" ref={registerReveal}>
          <h2 className="wa-h2">Яаж ажилладаг вэ</h2>
          <ol className="wa-steps">
            {STEPS.map((s) => (
              <li className="wa-step" key={s.n}>
                <span className="wa-step__n">{s.n}</span>
                <h3 className="wa-step__title">{s.title}</h3>
                <p className="wa-step__body">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 6. Features */}
        <section className="wa-section" ref={registerReveal}>
          <h2 className="wa-h2">Онцлог</h2>
          <div className="wa-features">
            {FEATURES.map((f) => (
              <div className="wa-feature" key={f.title}>
                <div className="wa-feature__icon">{f.icon}</div>
                <h3 className="wa-feature__title">{f.title}</h3>
                <p className="wa-feature__body">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 7. About */}
        <section className="wa-about" ref={registerReveal}>
          {eff === 'newyear' && <SantaHat className="on-about" />}
          <p className="wa-about__text">
            WorkAhead бол Монголын их сургуулиудын оюутнуудад зориулсан шалгалтын бэлтгэл платформ.
            Бид бодит хичээлийн даалгавар, AI үнэлгээгээр таны шалгалтын бэлтгэлийг хамгийн богино замаар хийж өгдөг.
          </p>
          <div className="wa-about__actions">
            <Link to="/register" className="btn primary lg">
              Бүртгүүлж эхлэх
            </Link>
            <Link to="/terms" className="link">
              Үйлчилгээний нөхцөл
            </Link>
          </div>
        </section>

        {/* 8. Payment strip */}
        <div className="wa-pay">
          <span className="wa-pay__label">Төлбөр:</span>
          <span className="wa-pay__badge">
            <img src="/logos/qpay.avif" alt="QPay" />
          </span>
          <span className="wa-pay__badge">
            <img src="/logos/socialpay.png" alt="SocialPay" />
          </span>
        </div>
      </main>

      {/* 9. Footer */}
      <footer className="wa-footer">
        <Link to="/terms" className="wa-footer__link">
          Үйлчилгээний нөхцөл
        </Link>
        <a href="tel:+97666336691" className="wa-footer__link">
          +976 6633 6691
        </a>
        <a
          href="https://www.facebook.com/profile.php?id=100068091317280"
          target="_blank"
          rel="noreferrer"
          className="wa-footer__link"
        >
          Facebook
        </a>
        <span className="wa-footer__copy">© 2026 WorkAhead</span>
      </footer>

      {/* Mobile sticky CTA */}
      <div className="landing-ctabar">
        <Link to="/register" className="btn primary">
          Бүртгүүлэх
        </Link>
        <Link to="/login" className="btn ghost">
          Нэвтрэх
        </Link>
      </div>
    </div>
  );
}
