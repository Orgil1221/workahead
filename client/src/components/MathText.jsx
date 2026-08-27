import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

// $...$ → inline, $$...$$ → block, плюс нүцгэн LaTeX командууд (\frac, \sqrt гэх мэт)
const MATH_SPLIT = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
// Нүцгэн LaTeX: \command{...}{...} эсвэл \command — $ байхгүй үед илрүүлж $...$ болгоно
const BARE_LATEX_RE = /\\[a-zA-Z]+(?:\s*\{[^{}]*\}){0,2}|\\[a-zA-Z]+/g;

function autoWrapBareLatex(str) {
  if (!str || str.includes('$')) return str;
  let out = str;
  // 1) \command{...} нүцгэн тохиолдол
  if (/\\[a-zA-Z]/.test(out)) {
    out = out.replace(BARE_LATEX_RE, (m) => `$${m}$`);
  }
  // 2) e^{...} , x_{...} зэрэг ^/_ + {} нүцгэн тохиолдол ( \ байхгүй ч {} харагдана)
  // Жишээ: "e^{4}" → "$e^{4}$", "x_{1}" → "$x_{1}$"
  if (/\^ *\{/.test(out) || /_ *\{/.test(out)) {
    // Хэрэв $ нэмээгүй үлдсэн ^{...} хэсгийг олж wrap хийх
    // Давхар $ үүсэхээс сэргийлж $...$ дотор байгааг шалгах шаардлагагүй (анх $ байгаагүй)
    out = out.replace(/([a-zA-Z0-9\)\]]\s*[\^_]\s*\{[^{}]+\})/g, (m) => `$${m}$`);
  }
  return out;
}

export default function MathText({ text }) {
  if (!text) return null;
  let raw = String(text);
  // 1) $ байхгүй ч \command байвал автоматаар $...$ нэмэх
  raw = autoWrapBareLatex(raw);
  const parts = raw.split(MATH_SPLIT);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          try { return <BlockMath key={i} math={part.slice(2, -2)} />; }
          catch { return <span key={i} style={{ color: 'var(--accent)' }}>{part}</span>; }
        }
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          try { return <InlineMath key={i} math={part.slice(1, -1)} />; }
          catch { return <span key={i}>{part.slice(1, -1)}</span>; }
        }
        return part ? <span key={i}>{part}</span> : null;
      })}
    </>
  );
}
