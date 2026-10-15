import { useEffect, useId, useMemo, useRef } from 'react';

const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);

export function WeatherCanvas({ mode, paused }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context || mode === 'clear') return;
    const rain = mode === 'rain';
    let width = 0;
    let height = 0;
    let particles = [];
    let ripples = [];
    let frame = 0;
    let previousTime = 0;
    let elapsed = 0;
    const makeSnowflakes = () => {
      const density = Math.max(.5, Math.min(1.3, width * height / 1000000));
      const layers = [
        { count: 50, radius: [.8, 1.7], speed: [.35, .8], color: 'rgba(160,180,210,0.5)' },
        { count: 40, radius: [1.6, 2.7], speed: [.7, 1.4], color: 'rgba(160,180,210,0.75)' },
        { count: 25, radius: [2.4, 4], speed: [1.2, 2.1], color: 'rgba(170,190,220,0.95)' },
      ];
      return layers.flatMap((layer) => Array.from({ length: Math.floor(layer.count * density) }, () => ({
        horizontal: randomBetween(0, width),
        vertical: randomBetween(0, height),
        phase: randomBetween(0, Math.PI * 2),
        radius: randomBetween(...layer.radius),
        speed: randomBetween(...layer.speed),
        drift: randomBetween(-.4, .4),
        color: layer.color,
      })));
    };

    const makeParticle = () => {
      const depth = [.25, .55, 1][Math.floor(Math.random() * 3)];
      return {
        horizontal: randomBetween(-30, width + 30),
        vertical: randomBetween(-30, height),
        depth,
        speed: randomBetween(420, 640) + depth * 620,
        length: randomBetween(9, 18) + depth * 14,
        ground: height - randomBetween(8, 85),
      };
    };

    const draw = (delta) => {
      elapsed += delta;
      const dark = document.documentElement.dataset.theme === 'dark';
      const wind = Math.sin(elapsed * .23) * 10 + Math.sin(elapsed * .61) * 4;
      const snowFrames = delta * 60;
      const gust = Math.sin(elapsed * .384) * 1.6 + Math.sin(elapsed * 1.248) * .7;
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        if (rain) {
          particle.vertical += particle.speed * delta;
          particle.horizontal += (-70 + wind) * particle.depth * delta;
          if (particle.vertical > particle.ground) {
            if (particle.depth > .5 && ripples.length < 22 && !paused) ripples.push({ horizontal: particle.horizontal, vertical: particle.ground, age: 0, radius: randomBetween(8, 19) });
            particle.vertical = -35;
            particle.horizontal = randomBetween(-30, width + 30);
          }
          if (particle.horizontal < -40) particle.horizontal = width + 30;
          if (particle.horizontal > width + 40) particle.horizontal = -30;
          context.strokeStyle = dark ? 'rgba(177,207,227,' + (.12 + particle.depth * .25) + ')' : 'rgba(66,105,136,' + (.1 + particle.depth * .22) + ')';
          context.lineWidth = .5 + particle.depth * .65;
          context.lineCap = 'round';
          context.beginPath();
          context.moveTo(particle.horizontal, particle.vertical);
          context.lineTo(particle.horizontal + (-70 + wind) / particle.speed * particle.length, particle.vertical + particle.length);
          context.stroke();
        } else {
          particle.phase += (.008 + particle.speed * .004) * snowFrames;
          particle.vertical += particle.speed * snowFrames;
          particle.horizontal += (particle.drift + Math.sin(particle.phase) * .5 + gust * .35) * snowFrames;
          if (particle.vertical > height + 8) { particle.vertical = -8; particle.horizontal = randomBetween(0, width); }
          if (particle.horizontal < -8) particle.horizontal = width + 8;
          if (particle.horizontal > width + 8) particle.horizontal = -8;
          context.fillStyle = particle.color;
          context.beginPath();
          context.arc(particle.horizontal, particle.vertical, particle.radius, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
      ripples = ripples.filter((ripple) => ripple.age < 1);
      for (const ripple of ripples) {
        ripple.age += delta * 1.7;
        context.strokeStyle = 'rgba(114,150,177,' + Math.max(0, (1 - ripple.age) * .25) + ')';
        context.lineWidth = .7;
        context.beginPath();
        context.ellipse(ripple.horizontal, ripple.vertical, ripple.radius * ripple.age + 1, (ripple.radius * ripple.age + 1) * .22, 0, 0, Math.PI * 2);
        context.stroke();
      }
    };

    const resize = () => {
      width = document.documentElement.clientWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.min(width < 600 ? 64 : 160, Math.max(30, Math.round(width * height / 7500)));
      particles = rain ? Array.from({ length: count }, makeParticle) : makeSnowflakes();
      ripples = [];
      draw(0);
    };
    const tick = (timestamp) => {
      if (!previousTime || timestamp - previousTime >= 1000 / 30) {
        draw(previousTime ? Math.min((timestamp - previousTime) / 1000, .06) : 0);
        previousTime = timestamp;
      }
      frame = requestAnimationFrame(tick);
    };
    const syncMotion = () => {
      cancelAnimationFrame(frame);
      previousTime = 0;
      if (!document.hidden && !paused) frame = requestAnimationFrame(tick);
      else draw(0);
    };
    const themeObserver = new MutationObserver(() => { if (paused || document.hidden) draw(0); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    resize();
    syncMotion();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', syncMotion);
    return () => {
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', syncMotion);
    };
  }, [mode, paused]);
  return mode === 'clear' ? null : <canvas ref={canvasRef} className="wa-weather-canvas" data-weather={mode} aria-hidden="true" />;
}

function PineBranch({ flipped = false }) {
  const needles = useMemo(() => Array.from({ length: 28 }, (_, index) => {
    const distance = index / 27;
    const horizontal = 12 + distance * 230;
    const vertical = 40 + Math.sin(distance * 1.3) * 70;
    const spread = 38 * (1 - distance * .65);
    return <g key={index} strokeLinecap="round">
      {[0, 1, 2, 3].map((offset) => <g key={offset}><path d={'M' + horizontal + ' ' + vertical + 'l' + (-20 + offset * 6) + ' ' + (-spread - offset * 3)} stroke={offset % 2 ? '#54795a' : '#254b39'} strokeWidth={1.1 + offset * .15} /><path d={'M' + horizontal + ' ' + vertical + 'l' + (-28 + offset * 5) + ' ' + (spread * .8 + offset * 3)} stroke={offset % 2 ? '#37664b' : '#173b2b'} strokeWidth="1.4" /></g>)}
    </g>;
  }), []);
  return <svg className={'wa-pine' + (flipped ? ' wa-pine--right' : ' wa-pine--left')} viewBox="0 0 270 180" fill="none" aria-hidden="true"><g><path d="M0 35C80 40 155 105 250 109" stroke="#5d5140" strokeWidth="3" />{needles}<path d="M15 35C60 36 94 57 120 67M150 84l24 8M202 103l22 3" stroke="#eaf1eb" strokeWidth="5" strokeLinecap="round" opacity=".8" /></g></svg>;
}

function Ornament({ className, gold, id }) {
  return <svg className={'wa-ornament ' + className} viewBox="0 0 100 180" fill="none" aria-hidden="true">
    <defs><radialGradient id={id} cx=".32" cy=".25" r=".8"><stop offset="0" stopColor={gold ? '#fff2ba' : '#ed766c'} /><stop offset=".32" stopColor={gold ? '#d2ad58' : '#b93436'} /><stop offset=".72" stopColor={gold ? '#9b702b' : '#7b1926'} /><stop offset="1" stopColor={gold ? '#59431c' : '#38141d'} /></radialGradient><radialGradient id={id + '-shine'} cx=".35" cy=".2"><stop stopColor="white" stopOpacity=".8" /><stop offset="1" stopColor="white" stopOpacity="0" /></radialGradient></defs>
    <path d="M50 0v80" stroke={gold ? '#c1a168' : '#9c8470'} strokeWidth=".8" />
    <path d="M46 84v-5a4 4 0 0 1 8 0v5" stroke="#b69a61" strokeWidth="1.5" />
    <rect x="40" y="84" width="20" height="9" rx="2" fill="#b39a67" /><path d="M43 85v7m4-7v7m5-7v7m5-7v7" stroke="#e9d59b" strokeWidth="1" />
    <circle cx="50" cy="126" r="36" fill={'url(#' + id + ')'} />
    <ellipse cx="38" cy="111" rx="19" ry="20" fill={'url(#' + id + '-shine)'} />
    <path d="M22 131c8 13 35 21 54 2" stroke="#f8e0ad" strokeWidth=".7" opacity=".5" />
    {gold && <path d="M18 120q32 20 64 0M19 135q31 17 62 0" stroke="#ffe9a3" strokeWidth="1" opacity=".55" />}
    <path d="M28 105q6-9 16-9" stroke="white" strokeWidth="3" strokeLinecap="round" opacity=".55" />
  </svg>;
}

export function FestiveDecor() {
  const id = useId().replace(/:/g, '');
  return <div className="wa-festive" aria-hidden="true">
    <PineBranch /><PineBranch flipped />
    <svg className="wa-light-string" viewBox="0 0 1200 95" preserveAspectRatio="none">
      <path d="M0 13Q300 116 600 31Q900 116 1200 13" fill="none" stroke="#63715b" strokeWidth="1.2" />
      {Array.from({ length: 25 }, (_, index) => {
        const horizontal = index * 50;
        const progress = (horizontal <= 600 ? horizontal : 1200 - horizontal) / 600;
        const vertical = (1 - progress) ** 2 * 13 + 2 * (1 - progress) * progress * 116 + progress ** 2 * 31;
        return <g key={index} className="wa-light" style={{ '--light-delay': index % 5 * -.9 + 's' }}><path d={'M' + horizontal + ' ' + vertical + 'v7'} stroke="#4c5b43" strokeWidth="1.2" /><circle cx={horizontal} cy={vertical + 13} r="12" fill="#efbb63" opacity=".12" /><rect x={horizontal - 2.5} y={vertical + 6} width="5" height="4" rx="1" fill="#726647" /><ellipse cx={horizontal} cy={vertical + 14} rx="3.3" ry="5.5" fill="#ffdf9c" /><ellipse cx={horizontal - .6} cy={vertical + 13} rx="1.2" ry="3.4" fill="#fff7d9" /></g>;
      })}
    </svg>
    <Ornament className="wa-ornament--red" id={id + '-red'} />
    <Ornament className="wa-ornament--gold" gold id={id + '-gold'} />
    <Ornament className="wa-ornament--small" gold id={id + '-small'} />
  </div>;
}

export function WeatherIcon({ mode, size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {mode === 'rain' ? <><path d="M6 14a4 4 0 1 1 1-7 5 5 0 0 1 9.5 1A3 3 0 1 1 18 14H6" /><path d="m8 17-1 3m6-3-1 3m6-3-1 3" /></> : mode === 'snow' ? <><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M17 19l-1-4 4-1M4 14l4 1-1 4M17 5l-1 4 4 1" /></> : mode === 'newyear' ? <><path d="m12 2 1.7 3.7 4 .5-3 2.8.8 4-3.5-2-3.5 2 .8-4-3-2.8 4-.5L12 2ZM12 14v8M6 16l-3 5h18l-3-5" /></> : mode === 'auto' ? <><path d="M20 7v5h-5M4 17v-5h5M5.5 7a7.5 7.5 0 0 1 12-2L20 8M4 16l2.5 3a7.5 7.5 0 0 0 12-2" /></> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}
  </svg>;
}
