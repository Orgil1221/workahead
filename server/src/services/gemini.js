const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export function aiConfigured() {
  return Boolean(KEY);
}

// Grade one open-ended math answer against the model solution via Gemini.
// Returns { pointsEarned, isCorrect, feedback } or null if not configured / failed.
export async function gradeAnswer({ prompt, modelSolution, answer, points, givenAnswer }) {
  if (!KEY || !givenAnswer?.trim()) return null;

  const system = [
    'Чи бол Монголын их сургуулийн математик шалгалтыг үнэлэгч професcор.',
    'Оюутны бичсэн бодолт болон иж бүрэн шийдэл, зөв хариултыг харьцуулан дүн өг.',
    'Дүнг оюутны ахисан алхмуудыг нь харгалзан шүү — зөвхөн эцсийн хариулт биш.',
    'Арга зүй зөв, зөвхөн тооцооллын жижиг алдаатай бол хагас оноо өгч болно.',
    'Томьёо, математик илэрхийллээ ЗААВАЛ KaTeX синтаксээр бич: inline бол $...$ хооронд.',
    'Emoji, смайлик хориглосон — цэвэр, албан ёсны академик хэлээр бич.',
    'Хариултаа ЗӨВХӨӨ JSON хэлбэрээр буцаа: {"pointsEarned": <number>, "isCorrect": <boolean>, "feedback": "<2-3 өгүүмж монгол хэлээр: юу зөв байсан, юу буруу, ямар томьёо/арга ашиглах ёстой байсан тухай>"}',
  ].join('\n');

  const user = [
    `Асуулт (${points} оноо):\n${prompt}`,
    modelSolution ? `\nИж бүрэн шийдэл:\n${modelSolution}` : '',
    answer ? `\nЗөв хариулт:\n${answer}` : '',
    `\n\nОюутны бодолт:\n${givenAnswer}`,
  ].join('\n');

  try {
    const res = await fetch(`${URL}?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
    const parsed = JSON.parse(text);
    const earned = Math.max(0, Math.min(Number(parsed.pointsEarned ?? 0), points));
    return {
      pointsEarned: earned,
      isCorrect: Boolean(parsed.isCorrect) || earned >= points,
      feedback: String(parsed.feedback || '')
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2B00}-\u{2BFF}]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500),
    };
  } catch {
    return null;
  }
}
