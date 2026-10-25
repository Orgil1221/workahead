import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

// $...$ → inline, $$...$$ → block, плюс нүцгэн LaTeX командууд (\frac, \sqrt гэх мэт)
const CONTENT_SPLIT = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|!\[[^\]]{0,120}\]\(data:image\/svg\+xml;base64,<svg\b[\s\S]*?<\/svg>\)|!\[[^\]]{0,120}\]\(data:image\/(?:png|jpeg|webp|svg\+xml);base64,[\sA-Za-z0-9+/=]+\))/g;
const IMAGE_MARKDOWN = /^!\[([^\]]{0,120})\]\((data:image\/(?:png|jpeg|webp|svg\+xml);base64,[\sA-Za-z0-9+/=]+|data:image\/svg\+xml;base64,(<svg\b[\s\S]*<\/svg>))\)$/;
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
  const parts = raw.split(CONTENT_SPLIT);
  return (
    <>
      {parts.map((part, i) => {
        const image = part.match(IMAGE_MARKDOWN);
        const imageSource = image?.[3]
            ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image[3])}`
            : image?.[2]?.replace(/\s/g, '');
        if (image && imageSource.length <= 2_000_000) {
          return <img key={i} src={imageSource} alt={image[1] || 'Асуултын зураг'} loading="lazy" style={{ display: 'block', width: '100%', maxWidth: '100%', maxHeight: 440, objectFit: 'contain', margin: '12px auto', borderRadius: 8 }} />;
        }
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
