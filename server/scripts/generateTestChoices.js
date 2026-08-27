import prisma from '../src/db.js';
import 'dotenv/config';

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function heuristicDistractors(answer, prompt) {
  const ans = String(answer || '').trim();
  // Try numeric
  const num = Number(ans.replace(/[^0-9.\-]/g, ''));
  if (!isNaN(num) && ans.match(/^[0-9.\-\s]+$/)) {
    const deltas = [1, -1, 2];
    // shuffle deltas and ensure not duplicate
    const distractors = deltas.map(d => String(num + d * (Math.abs(num) > 10 ? Math.ceil(Math.abs(num)/5) : 1))).slice(0,3);
    // ensure distinct and not equal to ans
    const uniq = [...new Set(distractors.filter(d => d !== ans))];
    while (uniq.length < 3) uniq.push(String(num + (uniq.length+3)*7));
    return uniq.slice(0,3);
  }
  // Generic: add typical wrong answers
  const base = ans || '3';
  return [
    base + ' + 1',
    base.replace(/=.*/, '').trim() + ' (эсрэг тэмдэг)',
    'Шийдгүй',
  ].slice(0,3);
}

async function geminiDistractors({ prompt, answer, modelSolution }) {
  if (!KEY) return null;
  const system = [
    'Чи бол Монголын их сургуулийн математикийн шалгалтын тест зохиогч.',
    'Өгөгдсөн задгай асуулт, зөв хариулт, бодолтыг харж 3 ХУДАЛ сонголт үүсгэ.',
    'Худал сонголтууд нь оюутны түгээмэл алдаанаас үүдсэн, итгэмээр, гэхдээ буруу байх ёстой.',
    'Бүх сонголтууд KaTeX-гүй энгийн текст/тоо байж болно, $...$ хэрэглэж болно.',
    'Хариугаа ЗӨВХӨН JSON массиваар буцаа: ["худал1","худал2","худал3"] — 3 элемент, тус бүр 1-80 тэмдэгт.',
  ].join('\n');
  const user = [
    `Асуулт:\n${prompt}`,
    answer ? `\nЗөв хариулт:\n${answer}` : '',
    modelSolution ? `\nБодолт:\n${modelSolution.slice(0,500)}` : '',
  ].join('\n');
  try {
    const res = await fetch(`${URL}?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      console.warn('Gemini distractor failed', res.status, await res.text().catch(()=> ''));
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') ?? '';
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : parsed.distractors || parsed.wrong || [];
    if (Array.isArray(arr) && arr.length >= 3) {
      return arr.slice(0,3).map(s=>String(s).trim()).filter(Boolean);
    }
    return null;
  } catch (e) {
    console.warn('Gemini error', e.message);
    return null;
  }
}

async function main() {
  const onlyMissing = process.argv.includes('--only-missing');
  const limitArg = process.argv.find(a=>a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 0;
  const useGemini = !process.argv.includes('--heuristic');

  const where = onlyMissing ? { choices: null } : {};
  // also find questions where choices is null or empty
  const questions = await prisma.question.findMany({
    where: {
      ...where,
      answer: { not: null },
    },
    select: { id: true, prompt: true, answer: true, modelSolution: true, choices: true, type: true, exam: { select: { title: true } } },
    orderBy: { createdAt: 'asc' },
  });

  let candidates = questions.filter(q => !q.choices || !Array.isArray(q.choices) || q.choices.length !== 4);
  if (limit) candidates = candidates.slice(0, limit);

  console.log(`Олдсон асуулт: ${questions.length}, сонголтгүй: ${candidates.length} (limit=${limit||'∞'})`);
  if (candidates.length === 0) {
    console.log('Бүх асуулт аль хэдийн сонголттой.');
    return;
  }

  let done = 0, failed = 0;
  for (const q of candidates) {
    const answer = String(q.answer || '').trim();
    if (!answer) { console.log(`- ${q.id} хариултгүй, алгаслаа`); continue; }

    let distractors = null;
    if (useGemini && KEY) {
      distractors = await geminiDistractors({ prompt: q.prompt, answer, modelSolution: q.modelSolution });
      // slight delay to avoid rate limit
      await new Promise(r=>setTimeout(r, 600));
    }
    if (!distractors) {
      distractors = heuristicDistractors(answer, q.prompt);
    }
    // Ensure 3 distractors not equal to answer and distinct
    distractors = [...new Set(distractors.map(s=>String(s).trim()).filter(s=>s && s.toLowerCase() !== answer.toLowerCase()))];
    while (distractors.length < 3) distractors.push(`${answer} (variant ${distractors.length+1})`);
    distractors = distractors.slice(0,3);

    const correctText = answer;
    const allChoices = [{ text: correctText, isCorrect: true }, ...distractors.map(t=>({ text: t, isCorrect: false }))];
    shuffle(allChoices);
    const keys = ['A','B','C','D'];
    const choices = allChoices.map((c,i)=>({ key: keys[i], text: c.text }));
    const correctChoice = choices.find((c,i)=> allChoices[i].isCorrect)?.key || 'A';

    try {
      await prisma.question.update({
        where: { id: q.id },
        data: {
          choices,
          correctChoice,
          // type хадгална — open хэвээр, тест горимд choices-ээр ашиглана
          // хэрвээ type test бол шууд, open бол choices-ээр test-д ашиглах боломжтой
        },
      });
      done++;
      console.log(`✓ ${done}/${candidates.length} ${q.exam?.title?.slice(0,20) || ''} | ${q.prompt.slice(0,40)}... → ${correctChoice}: ${correctText.slice(0,30)}`);
    } catch (e) {
      failed++;
      console.error(`✗ ${q.id} алдаа:`, e.message);
    }
  }
  console.log(`\nДууслаа: амжилттай ${done}, алдаа ${failed}`);
  if (done) console.log('Тест горимд одоо эдгээр асуултууд 4 сонголттой харагдана (isTest + choices).');
}

main().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1); });
