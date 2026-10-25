import prisma from '../db.js';

export function buildChoicesFromImport(q) {
  const hasChoicesInput = Array.isArray(q.choices) || q.choiceA || q.choiceB || q.choiceC || q.choiceD || q.correct_choice || q.correctChoice;
  // Only skip choices if neither test nor choices input provided
  if (!hasChoicesInput) return { choices: null, correctChoice: null };
  // Support: q.choices = [{key,text}] or q.choices as object, or choiceA..D + correct_choice
  let choices = null;
  if (Array.isArray(q.choices)) {
    choices = q.choices.map((c, i) => ({
      key: String(c.key || ['A', 'B', 'C', 'D'][i]).toUpperCase(),
      text: String(c.text || c || '').trim(),
    }));
  } else if (q.choiceA || q.choiceB || q.choiceC || q.choiceD) {
    choices = [
      { key: 'A', text: String(q.choiceA || '').trim() },
      { key: 'B', text: String(q.choiceB || '').trim() },
      { key: 'C', text: String(q.choiceC || '').trim() },
      { key: 'D', text: String(q.choiceD || '').trim() },
    ];
  }
  if (choices) {
    // Validate a complete choice set and its answer key
    const correct = String(q.correct_choice || q.correctChoice || '').toUpperCase().trim();
    const choiceKeys = new Set(choices.map((choice) => choice.key));
    if (choices.length < 2 || choices.length > 4 || !choices.every((c) => c.text) || choiceKeys.size !== choices.length) throw Object.assign(new Error(`Тест асуулт "${(q.prompt||'').slice(0,30)}": 2–4 ялгаатай сонголт шаардлагатай`), { status: 400 });
    if (!['A','B','C','D'].includes(correct) || !choiceKeys.has(correct)) throw Object.assign(new Error(`Тест асуулт "${(q.prompt||'').slice(0,30)}": correct_choice нь сонголтын A/B/C/D түлхүүртэй таарах ёстой`), { status: 400 });
    return { choices, correctChoice: correct };
  }
  // If hasChoicesInput but no valid choices array -> treat as needsReview
  return { choices: null, correctChoice: null };
}

/**
 * Import file format (matches files/*.json):
 * {
 *   exam_id, title, source, year, variant,
 *   questions: [{ type, prompt, model_solution, answer, points, needs_review, tags, choices, correct_choice, choiceA..D }]
 * }
 */
export async function importExamJson(data, programId) {
  if (!data || typeof data !== 'object') throw Object.assign(new Error('JSON бүтэц буруу'), { status: 400 });
  const required = ['exam_id', 'title', 'year', 'questions'];
  for (const key of required) {
    if (data[key] === undefined) throw Object.assign(new Error(`"exam_id", "title", "year", "questions" талбарууд шаардлагатай (${key} байхгүй)`), { status: 400 });
  }
  if (!Array.isArray(data.questions)) throw Object.assign(new Error('"questions" массив байх ёстой'), { status: 400 });

  const questions = data.questions.map((q, i) => {
    const isTest = (q.type || 'open') === 'test';
    const { choices, correctChoice } = buildChoicesFromImport(q);
    if (typeof q.prompt !== 'string' || !q.prompt.trim()) {
      throw Object.assign(new Error(`Асуулт ${i + 1}: prompt хоосон байна`), { status: 400 });
    }
    return {
      order: i + 1,
      type: isTest ? 'test' : 'open',
      topic: q.topic ?? q.tags?.[0] ?? null,
      level: q.level ?? null,
      year: q.year ?? Number(data.year),
      source: q.source ?? data.source ?? null,
      prompt: q.prompt,
      modelSolution: q.model_solution ?? q.explanation ?? null,
      answer: q.answer ?? null,
      choices,
      correctChoice,
      points: Number(q.points ?? 1),
      needsReview: isTest && !choices ? true : Boolean(q.needs_review ?? false),
      tags: Array.isArray(q.tags) ? q.tags : [],
    };
  });

  return prisma.$transaction(async (tx) => {
    const program = await tx.program.findUnique({ where: { id: programId }, select: { id: true } });
    if (!program) throw Object.assign(new Error('Хөтөлбөр олдсонгүй'), { status: 404 });

    const exam = await tx.exam.upsert({
      where: { code: data.exam_id },
      update: {
        title: data.title,
        source: data.source ?? null,
        year: Number(data.year),
        variant: data.variant ?? null,
        programId,
      },
      create: {
        code: data.exam_id,
        title: data.title,
        source: data.source ?? null,
        year: Number(data.year),
        variant: data.variant ?? null,
        programId,
      },
    });

    await tx.question.deleteMany({ where: { examId: exam.id } });
    await tx.question.createMany({ data: questions.map((question) => ({ ...question, examId: exam.id })) });
    return { examId: exam.id, code: exam.code, imported: data.questions.length };
  });
}

/**
 * CSV import — нэг мөр = нэг асуулт.
 * Баганууд: type,prompt,model_solution,answer,points,topic,tags
 * (prompt болон model_solution дотор шинэ мөр байж болно — "..." quote-аар хамгаална)
 */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

export async function importExamCsv({ programId, examCode, title, year, csv }) {
  if (!examCode || !title || !year) {
    throw Object.assign(new Error('examCode, title, year талбарууд шаардлагатай'), { status: 400 });
  }
  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) throw Object.assign(new Error('Хөтөлбөр олдсонгүй'), { status: 404 });

  const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw Object.assign(new Error('CSV хоосон эсвэл толгой мөрөөрөө л байна'), { status: 400 });

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name.toLowerCase());
  const iP = idx('prompt'), iM = idx('model_solution'), iA = idx('answer'),
        iPts = idx('points'), iT = idx('type'), iTop = idx('topic'), iTags = idx('tags'),
        iCA = idx('choicea'), iCB = idx('choiceb'), iCC = idx('choicec'), iCD = idx('choiced'),
        iCorr = idx('correct_choice') !== -1 ? idx('correct_choice') : idx('correctchoice');
  if (iP === -1) throw Object.assign(new Error('"prompt" багана заавал байх ёстой'), { status: 400 });

  const questions = rows.slice(1).map((r, i) => ({
    order: i + 1,
    type: (r[iT] || 'open').trim() || 'open',
    prompt: r[iP]?.trim(),
    modelSolution: r[iM]?.trim() || null,
    answer: r[iA]?.trim() || null,
    choiceA: iCA !== -1 ? r[iCA]?.trim() : null,
    choiceB: iCB !== -1 ? r[iCB]?.trim() : null,
    choiceC: iCC !== -1 ? r[iCC]?.trim() : null,
    choiceD: iCD !== -1 ? r[iCD]?.trim() : null,
    correct_choice: iCorr !== -1 ? r[iCorr]?.trim() : null,
    points: Number((r[iPts] || '1').trim()) || 1,
    topic: r[iTop]?.trim() || null,
    tags: (r[iTags] || '').split('|').map((t) => t.trim()).filter(Boolean),
  })).filter((q) => q.prompt);

  if (questions.length === 0) throw Object.assign(new Error('Асуулт олдсонгүй — prompt багана шалгана уу'), { status: 400 });

  return importExamJson({
    exam_id: examCode, title, year,
    questions: questions.map((q) => ({
      type: q.type, prompt: q.prompt, model_solution: q.modelSolution,
      answer: q.answer, points: q.points, topic: q.topic, tags: q.tags,
      choiceA: q.choiceA, choiceB: q.choiceB, choiceC: q.choiceC, choiceD: q.choiceD,
      correct_choice: q.correct_choice,
    })),
  }, programId);
}
