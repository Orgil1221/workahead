import { Router } from 'express';
import prisma from '../../db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

/* ---------- Universities ---------- */
router.get('/universities', async (_req, res, next) => {
  try {
    const universities = await prisma.university.findMany({
      orderBy: { name: 'asc' },
      include: { programs: { orderBy: { order: 'asc' }, include: { _count: { select: { exams: true } } } } },
    });
    res.json({ universities });
  } catch (e) { next(e); }
});

router.post('/universities', async (req, res, next) => {
  try {
    const university = await prisma.university.create({ data: { name: req.body.name, shortName: req.body.shortName || null } });
    res.status(201).json({ university });
  } catch (e) { next(e); }
});

router.put('/universities/:id', async (req, res, next) => {
  try {
    const university = await prisma.university.update({
      where: { id: req.params.id },
      data: { name: req.body.name, shortName: req.body.shortName || null },
    });
    res.json({ university });
  } catch (e) { next(e); }
});

router.delete('/universities/:id', async (req, res, next) => {
  try { await prisma.university.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }
  catch (e) { next(e); }
});

/* ---------- Programs ---------- */
router.post('/programs', async (req, res, next) => {
  try {
    const program = await prisma.program.create({
      data: {
        name: req.body.name,
        universityId: req.body.universityId,
        order: Number(req.body.order ?? 0),
        ...(req.body.code !== undefined ? { code: req.body.code || null } : {}),
        ...(req.body.school !== undefined ? { school: req.body.school || null } : {}),
      },
    });
    res.status(201).json({ program });
  } catch (e) { next(e); }
});

router.put('/programs/:id', async (req, res, next) => {
  try {
    const program = await prisma.program.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        ...(req.body.code !== undefined ? { code: req.body.code || null } : {}),
        ...(req.body.school !== undefined ? { school: req.body.school || null } : {}),
        ...(req.body.order !== undefined ? { order: Number(req.body.order) } : {}),
      },
    });
    res.json({ program });
  } catch (e) { next(e); }
});

// Reorder within parent
router.post('/programs/reorder', async (req, res, next) => {
  try {
    const { ids } = req.body; // ordered array of program ids
    await prisma.$transaction(ids.map((id, i) => prisma.program.update({ where: { id }, data: { order: i + 1 } })));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/programs/:id', async (req, res, next) => {
  try { await prisma.program.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }
  catch (e) { next(e); }
});

/* ---------- Exams ---------- */
router.get('/exams', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.programId) where.programId = req.query.programId;
    if (req.query.year) where.year = Number(req.query.year);
    const exams = await prisma.exam.findMany({
      where,
      orderBy: [{ year: 'desc' }, { order: 'asc' }],
      include: { program: { select: { name: true, university: { select: { name: true } } } }, _count: { select: { questions: true, attempts: true } } },
    });
    res.json({ exams });
  } catch (e) { next(e); }
});

router.get('/exams/:id', async (req, res, next) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: {
        program: { select: { name: true, university: { select: { name: true } } } },
        questions: { orderBy: { order: 'asc' } },
      },
    });
    if (!exam) return res.status(404).json({ error: 'Шалгалт олдсонгүй' });
    res.json({ exam });
  } catch (e) { next(e); }
});

router.post('/exams', async (req, res, next) => {
  try {
    const exam = await prisma.exam.create({ data: {
      programId: req.body.programId,
      code: req.body.code,
      title: req.body.title,
      source: req.body.source || null,
      year: Number(req.body.year),
      variant: req.body.variant || null,
      durationMin: req.body.durationMin ? Number(req.body.durationMin) : null,
      order: Number(req.body.order ?? 0),
      ...(req.body.isFree !== undefined && { isFree: Boolean(req.body.isFree) }),
    }});
    // Шинэ шалгалт төлбөртэй бол (isFree !== true) шууд 30 хоногийн багцад оруулна — багцгүй хүн нэвтэрч болохгүй
    if (!exam.isFree) {
      const defaultPlan = await prisma.plan.findFirst({ where: { code: 'seasonal-math1b' } });
      if (defaultPlan) {
        const exists = await prisma.planExam.findFirst({ where: { planId: defaultPlan.id, examId: exam.id } });
        if (!exists) await prisma.planExam.create({ data: { planId: defaultPlan.id, examId: exam.id } });
      }
    }
    res.status(201).json({ exam });
  } catch (e) { next(e); }
});

router.put('/exams/:id', async (req, res, next) => {
  try {
    const exam = await prisma.exam.update({ where: { id: req.params.id }, data: {
      ...(req.body.title !== undefined && { title: req.body.title }),
      ...(req.body.source !== undefined && { source: req.body.source }),
      ...(req.body.year !== undefined && { year: Number(req.body.year) }),
      ...(req.body.variant !== undefined && { variant: req.body.variant }),
      ...(req.body.durationMin !== undefined && { durationMin: req.body.durationMin ? Number(req.body.durationMin) : null }),
      ...(req.body.order !== undefined && { order: Number(req.body.order) }),
      ...(req.body.isFree !== undefined && { isFree: Boolean(req.body.isFree) }),
    }});
    // isFree=false бол багцад оруулах (30 хоногийн багц)
    if (req.body.isFree === false) {
      const defaultPlan = await prisma.plan.findFirst({ where: { code: 'seasonal-math1b' } });
      if (defaultPlan) {
        const exists = await prisma.planExam.findFirst({ where: { planId: defaultPlan.id, examId: exam.id } });
        if (!exists) await prisma.planExam.create({ data: { planId: defaultPlan.id, examId: exam.id } });
      }
    }
    res.json({ exam });
  } catch (e) { next(e); }
});

router.delete('/exams/:id', async (req, res, next) => {
  try { await prisma.exam.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }
  catch (e) { next(e); }
});

/* ---------- Questions ---------- */
router.get('/questions', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.examId) where.examId = req.query.examId;
    if (req.query.topic) where.topic = { contains: req.query.topic, mode: 'insensitive' };
    if (req.query.level) where.level = req.query.level;
    if (req.query.year) where.year = Number(req.query.year);
    if (req.query.type) where.type = req.query.type;
    if (req.query.tag) where.tags = { has: req.query.tag };
    if (req.query.needsReview === 'true') where.needsReview = true;
    if (req.query.q) where.prompt = { contains: req.query.q, mode: 'insensitive' };

    const pageSize = Math.min(Number(req.query.pageSize ?? 50), 200);
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const [total, questions] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        orderBy: [{ year: 'desc' }, { order: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          exam: { select: { title: true, year: true, variant: true } },
          _count: { select: { flags: { where: { status: 'NEW' } } } },
        },
      }),
    ]);
    res.json({ total, page, pageSize, questions });
  } catch (e) { next(e); }
});

router.get('/questions/:id', async (req, res, next) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { exam: { select: { title: true } }, flags: { orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } } },
    });
    if (!question) return res.status(404).json({ error: 'Асуулт олдсонгүй' });
    res.json({ question });
  } catch (e) { next(e); }
});

function normalizeChoices(b) {
  if (b.type !== 'test') return { choices: null, correctChoice: null };
  const raw = b.choices;
  let arr = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object') {
    arr = Object.entries(raw).map(([k, v]) => ({ key: String(k).toUpperCase(), text: String(v || '').trim() }));
  } else if (typeof b.choiceA === 'string' || typeof b.choiceB === 'string') {
    arr = [
      { key: 'A', text: String(b.choiceA || '').trim() },
      { key: 'B', text: String(b.choiceB || '').trim() },
      { key: 'C', text: String(b.choiceC || '').trim() },
      { key: 'D', text: String(b.choiceD || '').trim() },
    ];
  }
  // normalize to A,B,C,D order
  const keys = ['A', 'B', 'C', 'D'];
  arr = keys.map((k, i) => {
    const found = arr.find((x) => String(x.key || '').toUpperCase() === k);
    return { key: k, text: String(found?.text || arr[i]?.text || '').trim() };
  });
  const correct = String(b.correctChoice || b.correct_choice || '').toUpperCase().trim();
  if (arr.some((c) => !c.text)) throw Object.assign(new Error('Тест асуулт: 4 сонголт бүгд бөглөх ёстой'), { status: 400 });
  if (!['A', 'B', 'C', 'D'].includes(correct)) throw Object.assign(new Error('Зөв хариулт A/B/C/D аль нэг байх ёстой'), { status: 400 });
  return { choices: arr, correctChoice: correct };
}

router.post('/questions', async (req, res, next) => {
  try {
    const b = req.body;
    const count = await prisma.question.count({ where: { examId: b.examId } });
    const isTest = (b.type || 'open') === 'test';
    const { choices, correctChoice } = normalizeChoices(b);
    const question = await prisma.question.create({ data: {
      examId: b.examId,
      order: Number(b.order ?? count + 1),
      type: isTest ? 'test' : 'open',
      topic: b.topic || null,
      level: b.level || null,
      year: b.year ? Number(b.year) : null,
      source: b.source || null,
      prompt: b.prompt,
      modelSolution: b.modelSolution ?? b.explanation ?? null,
      answer: b.answer || null,
      choices: isTest ? choices : null,
      correctChoice: isTest ? correctChoice : null,
      points: Number(b.points ?? 1),
      needsReview: Boolean(b.needsReview ?? false),
      tags: Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    }});
    res.status(201).json({ question });
  } catch (e) { next(e); }
});

router.put('/questions/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const data = {
      ...(b.type !== undefined && { type: b.type === 'test' ? 'test' : 'open' }),
      ...(b.topic !== undefined && { topic: b.topic || null }),
      ...(b.level !== undefined && { level: b.level || null }),
      ...(b.year !== undefined && { year: b.year ? Number(b.year) : null }),
      ...(b.source !== undefined && { source: b.source || null }),
      ...(b.prompt !== undefined && { prompt: b.prompt }),
      ...(b.modelSolution !== undefined && { modelSolution: b.modelSolution || null }),
      ...(b.answer !== undefined && { answer: b.answer || null }),
      ...(b.points !== undefined && { points: Number(b.points) }),
      ...(b.needsReview !== undefined && { needsReview: Boolean(b.needsReview) }),
      ...(b.order !== undefined && { order: Number(b.order) }),
      ...(b.tags !== undefined && { tags: Array.isArray(b.tags) ? b.tags : String(b.tags).split(',').map((t) => t.trim()).filter(Boolean) }),
      ...(b.needs_review !== undefined && !b.needsReview && { needsReview: false }),
    };
    // Handle test choices if type is test or choices provided
    if (b.type === 'test' || b.choices !== undefined || b.correctChoice !== undefined || b.choiceA !== undefined) {
      const targetType = b.type ?? (await prisma.question.findUnique({ where: { id: req.params.id }, select: { type: true } }))?.type;
      if ((b.type ?? targetType) === 'test') {
        const { choices, correctChoice } = normalizeChoices({ ...b, type: 'test' });
        data.choices = choices;
        data.correctChoice = correctChoice;
        if (b.modelSolution !== undefined || b.explanation !== undefined) {
          data.modelSolution = b.modelSolution ?? b.explanation ?? null;
        }
      } else {
        data.choices = null;
        data.correctChoice = null;
      }
    }
    const question = await prisma.question.update({ where: { id: req.params.id }, data });
    // Editing a flagged question often resolves its flags implicitly
    if (b.resolveFlags) {
      await prisma.flag.updateMany({ where: { questionId: question.id, status: 'NEW' }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
    }
    res.json({ question });
  } catch (e) { next(e); }
});

router.post('/questions/reorder', async (req, res, next) => {
  try {
    const { ids } = req.body;
    await prisma.$transaction(ids.map((id, i) => prisma.question.update({ where: { id }, data: { order: i + 1 } })));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/questions/:id', async (req, res, next) => {
  try { await prisma.question.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }
  catch (e) { next(e); }
});

export default router;
