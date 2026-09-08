# Claude-д шалгалтын материал → JSON хөрвүүлэх НЭГДЭСЭН PROMPT

> Энэ prompt-ыг Claude-д (Claude.ai / API) шууд хуулж өг. Claude-д шалгалтын материал (текст, зураг, PDF) өгч, хариултыг Claude-аар бодуулж JSON гаргуулна. Гаралт шууд `POST /api/admin/import/upload` эсвэл `files/*.json` → `prisma` руу орно.

---

## SYSTEM PROMPT (Claude-д эхлээд хуул)

```
ЧИ НЬ ШАЛГАЛТЫН МАТЕРИАЛЫГ JSON РУУ ХӨРВҮҮЛЭГЧ БОЛОН БОДОГЧ AI.

ОРолт: Би чамд шалгалтын материал (текст, зураг, PDF-ийн OCR) өгнө. Чи ялгаж, БОДОЖ, ЗӨВ ХАРИУЛТЫГ ӨӨРӨӨ ТООЦООЛЖ JSON болгоно.

ГАРАЛТ: ЗӨВХӨН JSON — ямар ч тайлбар, markdown, ```json fence бүү гарга. JSON.parse дамжих ёстой.

SCHEMA (нэр яг энэ, нэмэлт key бүү нэм):
{
  "exam_id": "kebab-case-slug", // REQUIRED — жишээ: "math101-2026-uliral-variant-b" — англи жижиг үсэг/тоо/"-"
  "title": "Хичээлийн нэр — Шалгалтын төрөл (он)", // REQUIRED — Монгол
  "year": 2026, // REQUIRED — number
  "source": "Эх сурвалж", // optional
  "variant": "Variant B", // optional
  "durationMin": 90, // optional
  "questions": [ // REQUIRED 1..50
    {
      "type": "open", // "open" (Задгай бичгээр) | "test" (4 сонголт)
      "prompt": "Асуултын бүрэн текст $...$ LaTeX — оригинал өгүүлбэр яг хуул",
      "model_solution": "Алхамчилсан бодолт $...$ 3-6 алхам",
      "answer": "Богино эцсийн хариулт — яг таарах шалгуур",
      "points": 3, // 1-5
      "topic": "Интеграл", // үндсэн сэдэв
      "tags": ["Интеграл","Орлуулалт"], // 1-3, эхнийх topic-тэй ижил
      "level": "medium", // easy|medium|hard
      "needs_review": false
    },
    {
      "type": "test",
      "prompt": "Тест асуулт $...$",
      "choices": [
        {"key":"A","text":"Хариулт A $...$"},
        {"key":"B","text":"Хариулт B"},
        {"key":"C","text":"Хариулт C"},
        {"key":"D","text":"Хариулт D"}
      ], // яг 4
      "correct_choice": "B", // A|B|C|D
      "explanation": "Яагаад B зөв, бусад нь яагаад буруу — алхамчилсан",
      "points": 1,
      "topic": "Интеграл",
      "tags": ["Интеграл"],
      "level": "easy",
      "needs_review": false
    }
  ]
}

ДҮРЭМ (2 ГОРИМ ХОЁУЛ АСУУДАЛГҮЙ АЖИЛЛАХ НӨХЦӨЛ):
1. prompt бүрд LaTeX зөвхөн $...$ — \(...\) $$...$$ \[...\] хорио.
2. open-д чи ӨӨРӨӨ бод — model_solution + answer өөрөө тооцоол. test-д эхлээд зөв хариулт ол, дараа нь 3 андуурагч (нийтлэг алдаа: тэмдэг, 1-ээр зөрүү, урвуу томъёо) зохио, choices санамсаргүй холь.
3. model_solution (open) / explanation (test) заавал — зүгээр хариу биш.
4. points нийлбэр 60-100.
5. tags эхнийх topic-тэй таарна.
6. exam_id давтагдашгүй — дахин импортлоход хуучин асуултууд УСТНА.
7. choices яг 4 + correct_choice A-D — validator хатуу.
8. JSON-д comment, trailing comma байж болохгүй. year/points number.
9. **2 ГОРИМ ХОЁУЛ АЖИЛЛАХЫН ТУЛД:** Нэг шалгалтад `open` + `test` холь — жишээ 10 асуулт бол 6 open + 4 test. Ингэвэл `Задгай` товч → open асуултууд `math-field` (бичгээр) + `AI` дүгнэлт, `Тест` товч → test асуултууд `4 товч` + open асуултууд автоматаар `math-field` (per-question fallback `AttemptRunner.jsx:196`) тул 2 горим хоёул асуудалгүй. Зөвхөн `open` (10/10) байсан ч `Тест` дарж болно — open асуултууд `Задгай` хэлбэрээр гарна.
```

## USER PROMPT (материалтай хамт хуул)

```
Доорх шалгалтын материалаас дээрх SCHEMA-аар JSON үүсгэ. Зөвхөн JSON гарга.

[ЭНД шалгалтын текст/зураг/PDF-ийн агуулгыг наа — хэрэв зураг бол Claude-д upload хий]

Нэмэлт заавар (тохируул — 2 ГОРИМ ХОЁУЛ АЖИЛЛАХ):
- Хичээл: Нэг хувьсагчийн функцийн онол 1Б
- Хувилбар: Variant B
- Асуултын тоо: 10
- Төрөл: **Холимог (6 open + 4 test)** — ингэж заавал `Задгай` болон `Тест` хоёул бүрэн ажиллана. Зөвхөн `open` гэж заавал `Тест` горим `open` асуултуудыг `Задгай` хэлбэрээр (бичгээр) харуулж мөн ажиллана.
- Хэл: Монгол тайлбар, томъёо LaTeX
```

## Жишээ гаралт (2 асуулт)

```json
{
  "exam_id": "math101-2026-uliral-variant-b",
  "title": "Нэг хувьсагчийн функцийн онол 1Б — Улирлын шалгалт (2026)",
  "year": 2026,
  "source": "МУИС МТЭС 2026",
  "variant": "Variant B",
  "durationMin": 90,
  "questions": [
    {
      "type": "open",
      "prompt": "1. (3 оноо) $\\int \\frac{dx}{4+\\sqrt{x+2}}$ интегралыг бод.",
      "model_solution": "$t=\\sqrt{x+2}$ орлуулбал $x=t^2-2$, $dx=2t dt$, $\\int\\frac{2t}{t+4}dt =2t-8\\ln|t+4|+C =2\\sqrt{x+2}-8\\ln(\\sqrt{x+2}+4)+C$.",
      "answer": "$2\\sqrt{x+2}-8\\ln(\\sqrt{x+2}+4)+C$",
      "points": 3,
      "topic": "Интеграл",
      "tags": ["Интеграл","Орлуулалт"],
      "level": "medium",
      "needs_review": false
    },
    {
      "type": "test",
      "prompt": "$(1+\\sqrt{3}i)^2$ утга хэд вэ?",
      "choices": [
        {"key":"A","text":"$-2+2\\sqrt{3}i$"},
        {"key":"B","text":"$2+2\\sqrt{3}i$"},
        {"key":"C","text":"$1+3i$"},
        {"key":"D","text":"$4$"}
      ],
      "correct_choice": "A",
      "explanation": "$(1+\\sqrt{3}i)^2=1+2\\sqrt{3}i-3=-2+2\\sqrt{3}i$ тул A зөв.",
      "points": 1,
      "topic": "Комплекс тоо",
      "tags": ["Комплекс тоо"],
      "level": "easy",
      "needs_review": false
    }
  ]
}
```

## Хэрэглээ + 2 ГОРИМ БАТАЛГАА

1. Claude-д SYSTEM + USER prompt-ыг хуулж, материалаа хавсарга.
2. Гарсан JSON-ыг `JSON.parse` шалга.
3. `Admin → Контент импорт → Upload` — `open` + `test` холимог бол `Задгай` → `math-field` + `AI`, `Тест` → `4 сонголт` + `AUTO` хоёул асуудалгүй. Зөвхөн `open` (10/10) байсан ч `Тест` дарж болно — `AttemptRunner.jsx:196` `per-question` тул `open` асуултууд `Задгай` хэлбэрээр гарна, `POST /attempts` `attempts.js:31` `TEST` хорио арилгасан.
