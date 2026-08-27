import 'mathlive';

// ─────────────────────────────────────────────────────────────────────────────
// PhotoMath маягийн виртуал клавиатур — MathLive-ийн албан ёсны custom keyboard
// API (window.mathVirtualKeyboard.layouts) дээр суурилсан бүрэн шинэчлэл.
//
// Бүтэц: гурван тогтмол бүс (бие даан гулсдаггүй, давхцдаггүй):
//   Zone 1 — Action bar: abc · 🕘 · ← · → · ↵ · ⌫  (хэзээ ч солигддоггүй)
//   Zone 2 — 4 категорийн pill tab (идэвхтэй нь бараан өнгөтэй)
//   Zone 3 — Keypad: зүүн 2 багана = идэвхтэй табын контекст, баруун 4 багана =
//            тогтмол тоон/оператор пэд.
//
// Layer сэлгэлт: зөвхөн MathLive-ийн өөрийн ['switchKeyboardLayer', id] —
// .MLK__layer { display:none } / .is-visible механизм layer-ийг бүрэн
// unmount хийдэг тул давхардал/сүнс мөр үүсэх боломжгүй.
//
// АНХААР: клавиатур нь Shadow DOM дотор рендерлэгддэг тул дотоод элементүүдийг
// document CSS-ээр биш, зөвхөн layer-ийн <style> + өвлөгдөх CSS хувьсагчаар
// загварчилна.
// ─────────────────────────────────────────────────────────────────────────────

const K = (latex, label, cls = '') =>
  cls ? { latex, label, class: cls } : { latex, label };
const D = (n) => ({ latex: String(n), class: 'digit' });

// ── Zone 1: Action bar — layer бүрэнд ижил, хэзээ ч өөрчлөгдөхгүй эгнээ ──
// Цагны тэмдэг — emoji биш, inline SVG (бүх платформ дээр ижил харагдана)
const CLOCK_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.2 2.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const ACTION_BAR = [
  { label: 'abc', class: 'action act-text', command: ['switchKeyboardLayer', 'text'] },
  {
    label: CLOCK_ICON,
    class: 'action act-recent',
    tooltip: 'Сүүлд ашигласан тэмдэгтүүд',
    variants: [
      '\\pi', '\\infty', '\\leq', '\\geq', '\\neq', '\\pm',
      '\\sqrt{#0}', '\\frac{#@}{#?}', '\\times', '\\div', '^\\circ', '\\theta',
    ],
  },
  '[left]',
  '[right]',
  { label: '↵', class: 'action act-return', command: ['hideVirtualKeyboard'] },
  '[backspace]',
];

// ── Zone 2: Категорийн pill tabs — мөн layer бүрэнд ижил ──
// Label-ийг дараалан цувуулж биш, pill дотор 2×2 тороор байрлуулна
const grid2x2 = (a, b, c, d) =>
  `<span class="tab-grid"><b>${a}</b><b>${b}</b><b>${c}</b><b>${d}</b></span>`;

const TABS = [
  { label: grid2x2('+', '−', '×', '÷'), class: 'tab tab-arithmetic', command: ['switchKeyboardLayer', 'arithmetic'] },
  { label: grid2x2('≤', '≥', '≠', '⊂'), class: 'tab tab-comparison', command: ['switchKeyboardLayer', 'comparison'] },
  { label: grid2x2('f(x)', 'e', 'log', 'ln'), class: 'tab tab-functions', command: ['switchKeyboardLayer', 'functions'] },
  { label: grid2x2('sin', 'cos', 'tan', 'cot'), class: 'tab tab-calculus', command: ['switchKeyboardLayer', 'calculus'] },
];

// ── Zone 3 (баруун 4 багана): тогтмол тоон/оператор пэд ──
const FIXED_ROWS = [
  [D(7), D(8), D(9), K('\\div', '÷')],
  [D(4), D(5), D(6), K('\\times', '×')],
  [D(1), D(2), D(3), K('-', '−')],
  [D(0), K('.', '.'), K('=', '='), K('+', '+')],
];

// ── Zone 3 (зүүн 2 багана): таб тутмын контекст товчууд ──
// variants бүхий товч (hold-оор сонголт гарна) мөн 'template' class-тай —
// улаан цэгтэй ялгарна.
const CONTEXTUAL = {
  arithmetic: [
    [K('\\left(#?\\right)', '(□)', 'template'), {
      latex: '>', label: '>', class: 'template', variants: ['<', '\\leq', '\\geq'],
    }],
    [K('\\frac{#@}{#?}', '□⁄□', 'template'), K('\\sqrt{#0}', '√□', 'template')],
    [K('#0^{2}', '□²', 'template'), {
      latex: 'x', label: 'x', class: 'template tex', variants: ['y', 'z', 't'],
    }],
    [K('\\pi', 'π'), K('\\%', '%')],
  ],
  comparison: [
    [K('\\leq', '≤'), K('\\geq', '≥')],
    [K('\\neq', '≠'), K('\\subset', '⊂')],
    [K('\\in', '∈'), K('\\cup', '∪')],
    [K('\\cap', '∩'), {
      latex: '(', label: '(', class: 'template', variants: [')', '\\left[', '\\right]'],
    }],
  ],
  functions: [
    [K('f\\left(#?\\right)', 'f(x)', 'template tex-math'), K('\\log_{#?}', 'log', 'template')],
    [K('e', 'e', 'tex'), K('\\ln', 'ln', 'tex')],
    [K('#0^{#?}', 'xʸ', 'template'), K('#0^{-1}', 'x⁻¹', 'template')],
    [K('\\sqrt{#0}', '√□', 'template'), K('\\sqrt[#?]{#0}', 'ⁿ√□', 'template')],
  ],
  calculus: [
    [K('\\sin', 'sin', 'tex'), K('\\cos', 'cos', 'tex')],
    [K('\\tan', 'tan', 'tex'), K('\\cot', 'cot', 'tex')],
    [K('\\lim_{n \\to \\infty}', 'lim', 'template tex'), K('\\int', '∫')],
    [K('dx', 'dx'), K('\\sum_{i=1}^{n}', 'Σ', 'template big-op')],
  ],
};

const CONTEXT_ORDER = ['arithmetic', 'comparison', 'functions', 'calculus'];

// ── Layer style: зөвхөн өөрийн layer доторх идэвхтэй pill-ийг тэмдэглэнэ.
// Бүх селектор `.MLK__layer.is-visible` хамрах хүрээтэй тул layer хоорондын
// стиль зөрчилдөхгүй (хуучин ghost-layer bug-ийн шалтгаан).
const layerStyle = (id) => `
  /* Zone 3 — бүх товч мөрөө тэгш дүүргэнэ (утасны дэлгэцэнд шахагдахгүй) */
  .MLK__layer.is-visible .MLK__row > div {
    flex: 1 1 0;
    min-width: 0;
    width: auto;
    max-width: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Zone 2 — segmented pills */
  .MLK__layer.is-visible .MLK__row .tab {
    flex: 1 1 0;
    min-width: 0;
    border-radius: 999px;
    background: var(--mkb-tab-bg, #eceae4);
    color: var(--mkb-tab-text, #3c372e);
    font-size: var(--mkb-tab-font-size, .95rem);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Pill доторх 2×2 тор — дээд мөр: a b, доод мөр: c d */
  .MLK__layer.is-visible .tab .tab-grid {
    display: grid;
    grid-template-columns: auto auto;
    justify-content: center;
    column-gap: .5em;
    row-gap: 0;
    line-height: 1.12;
    font-weight: 700;
  }
  .MLK__layer.is-visible .tab .tab-grid b { font-weight: 700; }
  .MLK__layer.is-visible .tab.tab-${id} {
    background: var(--mkb-tab-active-bg, #26221b);
    color: var(--mkb-tab-active-text, #fffdf7);
  }

  /* Zone 1 — action bar: бусад товчноо ялгаатай саарал дэвсгэр,
     дарахад тод сааралжиж мэдрэгдэнэ */
  .MLK__layer.is-visible .action {
    background: var(--keycap-secondary-background, #efece3);
    color: var(--keycap-secondary-text, var(--ink-soft));
    transition: background .12s ease, transform .08s ease;
  }
  .MLK__layer.is-visible .action:active {
    background: var(--keycap-background-pressed, #e0dacb);
    transform: scale(.96);
  }
  .MLK__layer.is-visible .act-text { font-size: .8rem; font-weight: 700; letter-spacing: .02em; }
  .MLK__layer.is-visible .act-recent svg {
    width: 19px;
    height: 19px;
    display: block;
  }
  .MLK__layer.is-visible .act-return { font-weight: 700; }

  /* Zone 3 — тогтмолdigit пэд */
  .MLK__layer.is-visible .digit {
    background: var(--mkb-digit, #f0f0ee);
  }

  /* Улаан цэг — placeholder/variants (урт даралтаар нэмэлт сонголттой) товчны
     баруун доод буланд тэмдэглэнэ */
  .MLK__layer.is-visible .template {
    position: relative;
  }
  .MLK__layer.is-visible .template::after {
    content: '';
    position: absolute;
    right: 6px;
    bottom: 5px;
    width: 5.5px;
    height: 5.5px;
    border-radius: 50%;
    background: var(--accent, #a03123);
    pointer-events: none;
  }

  @media (max-width: 480px) {
    .MLK__layer.is-visible .MLK__row .tab {
      font-size: var(--mkb-tab-font-size-sm, .8rem);
      padding-left: 3px;
      padding-right: 3px;
    }
    .MLK__layer.is-visible .act-recent svg { width: 17px; height: 17px; }
  }
`;

// ── Layer үүсгэгч: Zone1 + Zone2 + (контекст 2 багана ∥ тогтмол 4 багана) ──
const makeLayer = (id) => ({
  id,
  style: layerStyle(id),
  rows: [
    ACTION_BAR,
    TABS,
    [...CONTEXTUAL[id][0], ...FIXED_ROWS[0]],
    [...CONTEXTUAL[id][1], ...FIXED_ROWS[1]],
    [...CONTEXTUAL[id][2], ...FIXED_ROWS[2]],
    [...CONTEXTUAL[id][3], ...FIXED_ROWS[3]],
  ],
});

// ── abc (текст) layer: үсгийн пэд — Zone 1/2 хэвээр үлдэнэ ──
const textLayer = {
  id: 'text',
  style: layerStyle('text'),
  rows: [
    ACTION_BAR,
    TABS,
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '[backspace]'],
    [K(' ', '␣'), K(',', ','), K('.', '.'), K('-', '−'), K('\\left(#?\\right)', '(□)', 'template act-pair')],
  ],
};

window.mathVirtualKeyboard.layouts = [
  {
    label: 'PhotoMath math',
    tooltip: 'Математик оруулагч',
    displayEditToolbar: false,
    layers: [...CONTEXT_ORDER.map(makeLayer), textLayer],
  },
];
