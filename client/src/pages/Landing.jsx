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

// Canvas бороо/цас — hero дэвсгэр дээр, pointer-eventsгүй, хөнгөн
function WeatherFx({ mode }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || (mode !== 'rain' && mode !== 'snow')) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    let raf = 0;
    let W = 0;
    let H = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      W = parent.clientWidth;
      H = parent.clientHeight;
      canvas.width = Math.max(1, W * dpr);
      canvas.height = Math.max(1, H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const isRain = mode === 'rain';
    const count = Math.max(30, Math.min(isRain ? 140 : 100, Math.floor(W / 9)));
    const rnd = (a, b) => a + Math.random() * (b - a);
    const parts = Array.from({ length: count }, () => ({
      x: rnd(0, W),
      y: rnd(0, H),
      r: isRain ? 0 : rnd(1, 3.4),
      len: isRain ? rnd(10, 22) : 0,
      sp: isRain ? rnd(9, 15) : rnd(0.5, 1.6),
      ph: rnd(0, Math.PI * 2),
      drift: isRain ? rnd(-2.5, -1) : rnd(-0.4, 0.4),
    }));
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      if (isRain) {
        ctx.strokeStyle = 'rgba(105,145,200,0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const p of parts) {
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.drift, p.y + p.len);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(160,180,210,0.9)';
        for (const p of parts) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    const step = () => {
      for (const p of parts) {
        p.y += p.sp;
        p.x += p.drift + (isRain ? 0 : Math.sin(p.ph += 0.01) * 0.4);
        if (p.y > H + 24) { p.y = -24; p.x = rnd(0, W); }
        if (p.x < -24) p.x = W + 24;
        if (p.x > W + 24) p.x = -24;
      }
      draw();
      raf = requestAnimationFrame(step);
    };
    draw();
    if (!prefersReducedMotion()) raf = requestAnimationFrame(step);
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
      <path d="M8 38 Q10 20 26 14 Q34 11 40 14 L36 20 Q30 17 24 20 Q12 25 12 38 Z" fill="#d22630" />
      <rect x="6" y="36" width="28" height="8" rx="4" fill="#fff" stroke="#e2ddd2" strokeWidth="1" />
      <circle cx="40" cy="15" r="5" fill="#fff" stroke="#e2ddd2" strokeWidth="1" />
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

const STEPS = [
  {
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

const WTHEME_KEY = 'wa_landing_theme';

export default function Landing() {
  const { user } = useAuth();

  const [stats, setStats] = useState(null); // { courses, universities } | null
  const [statsFailed, setStatsFailed] = useState(false);
  const [courseCount, setCourseCount] = useState(0);
  const [uniCount, setUniCount] = useState(0);

  // Цаг агаар theme: auto | clear | rain | snow | newyear
  const [wtheme, setWtheme] = useState(() => {
    try { return localStorage.getItem(WTHEME_KEY) || 'auto'; } catch { return 'auto'; }
  });
  const [wx, setWx] = useState(null); // { temp, fx } | null — Open-Meteo Улаанбаатар

  const statsRef = useRef(null);
  const statsCountedRef = useRef(false);
  const revealRefs = useRef([]);

  // Нэвтэрсэн хэрэглэгч landing харахгүй — useAuth (wa_token/wa_user) дээр суурилав.
  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/student'} replace />;
  }

  const changeTheme = (v) => {
    setWtheme(v);
    try { localStorage.setItem(WTHEME_KEY, v); } catch {}
  };

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

  // Public stats — plain fetch, never the app's api() helper (it redirects on 401).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/programs-public')
      .then((res) => {
        if (!res.ok) throw new Error('programs-public failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
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

  return (
    <div className="landing" data-wtheme={eff}>
      {/* 1. Navbar */}
      <header className="wa-nav">
        <div className="wa-nav__inner">
          <span className="wa-logo">
            {eff === 'newyear' && <SantaHat className="on-logo" />}
            Work<span className="wa-logo__dot">·</span>Ahead
          </span>
          <div className="wa-nav__actions">
            <select
              className="wtheme-select"
              value={wtheme}
              onChange={(e) => changeTheme(e.target.value)}
              aria-label="Цаг агаарын сэдэв"
              title="Цаг агаарын сэдэв"
            >
              <option value="auto">Авто</option>
              <option value="clear">Энгийн</option>
              <option value="rain">Бороо</option>
              <option value="snow">Цас</option>
              <option value="newyear">Шинэ жил</option>
            </select>
            <ThemeToggle compact />
            <Link to="/login" className="wa-btn wa-btn--ghost">
              Нэвтрэх
            </Link>
            <Link to="/register" className="wa-btn wa-btn--primary">
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
          <WeatherFx mode={fx} />
          <div className="wa-hero__grid">
            <div className="wa-hero__copy">
              <span className="wa-pill">Улирлын · Явцын шалгалт</span>
              {wtheme === 'auto' && wx && (
                <span className="wa-pill wx-pill">УБ: {wx.temp}°C{wx.fx === 'rain' ? ' · Бороо' : wx.fx === 'snow' ? ' · Цас' : ''}</span>
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
              <p className="wa-hero__note">Бүртгэл үнэ төлбөргүй • QPay, SocialPay-гаар төлбөр</p>
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
          <p className="wa-about__text">
            WorkAhead бол Монголын их сургуулиудын оюутнуудад зориулсан шалгалтын бэлтгэл платформ.
            Бид бодит хичээлийн даалгавар, AI үнэлгээгээр таны шалгалтын бэлтгэлийг хамгийн богино замаар хийж өгдөг.
          </p>
          <div className="wa-about__actions">
            <Link to="/register" className="wa-btn wa-btn--primary wa-btn--lg">
              Бүртгүүлж эхлэх
            </Link>
            <Link to="/terms" className="wa-link">
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
        <Link to="/register" className="wa-btn wa-btn--primary">
          Бүртгүүлэх
        </Link>
        <Link to="/login" className="wa-btn wa-btn--ghost">
          Нэвтрэх
        </Link>
      </div>
    </div>
  );
}
