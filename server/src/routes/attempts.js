import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { userHasExamAccess, paymentRequired } from '../services/access.js';
import { gradeAnswer, aiConfigured } from '../services/gemini.js';
import { shuffleChoicesForAttempt } from '../services/shuffle.js';

const router = Router();
router.use(requireAuth);

function normalizeAnswer(s) {
  if (!s) return '';
  return String(s).trim().replace(/\s+/g, ' ').replace(/^\$+|\$+$/g, '').toLowerCase();
}

// Start an attempt — TEST (сонголт) эсвэл TIMED (Задгай даалгавар)
router.post('/', async (req, res, next) => {
  try {
    const { examId, mode } = req.body;
    // PRACTICE устгасан — хуучин дуудлага TIMED руу шилжинэ
    const normalizedMode = mode === 'TEST' ? 'TEST' : 'TIMED';
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return res.status(404).json({ error: 'Шалгалт олдсонгүй' });
    const hasAccess = await userHasExamAccess(req.user.id, examId);
    if (!hasAccess) {
      const planExam = await prisma.planExam.findFirst({
        where: { examId },
        include: { plan: { select: { title: true } } },
      });
      return next(paymentRequired(planExam?.plan?.title));
    }
    if (normalizedMode === 'TEST') {
      const qs = await prisma.question.findMany({ where: { examId }, select: { type: true, choices: true } });
      const hasTestChoices = qs.some((q) => q.type === 'test' || (Array.isArray(q.choices) && q.choices.length === 4));
      if (!hasTestChoices) {
        return res.status(400).json({ error: 'Энэ шалгалтад тест сонголт оруулаагүй байна — зөвхөн Задгай горимоор ажиллах боломжтой. Админ тест асуулт (4 сонголт + correct_choice) нэмж оруулна уу.' });
      }
    }
    const attempt = await prisma.testAttempt.create({
      data: {
        userId: req.user.id,
        examId,
        mode: normalizedMode,
        format: normalizedMode === 'TEST' ? 'TEST' : 'OPEN',
        totalPoints: 0,
      },
    });
    res.status(201).json({ attempt });
  } catch (e) { next(e); }
});

// Save one answer — TEST бол автоматаар, Задгай бол зөв хариулттай таарвал автоматаар, үгүй бол AI
router.post('/:id/answers', async (req, res, next) => {
  try {
    const attempt = await prisma.testAttempt.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!attempt) return res.status(404).json({ error: 'Тест олдсонгүй' });
    if (attempt.finishedAt) return res.status(400).json({ error: 'Тест аль хэдийн дууссан' });
    const { questionId, givenAnswer } = req.body;
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) return res.status(404).json({ error: 'Асуулт олдсонгүй' });

    let pointsEarned = 0;
    let isCorrect = false;
    let feedback = null;
    let gradedBy = null;

    const isTestQuestion = question.type === 'test' || (attempt.mode === 'TEST' && Array.isArray(question.choices) && question.choices.length === 4);
    if (isTestQuestion) {
      // TEST: A/B/C/D — шууд шалгана, AI оролцохгүй; per-attempt random shuffle тул attemptId-ээр хольсон correctChoice-тай харьцуулна
      const given = String(givenAnswer || '').trim().toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(given)) {
        return res.status(400).json({ error: 'Сонголт A/B/C/D байх ёстой' });
      }
      let correct = String(question.correctChoice || '').toUpperCase();
      // Shuffle per attempt — same seed as GET /exams?attemptId, so student's seen order matches grading
      if (attempt.mode === 'TEST' && Array.isArray(question.choices) && question.choices.length === 4) {
        const shuffled = shuffleChoicesForAttempt(question.choices, question.correctChoice, attempt.id, question.id);
        correct = String(shuffled.correctChoice || '').toUpperCase();
      }
      if (!correct) return res.status(500).json({ error: 'Тест асуултын зөв хариулт тохируулаагүй байна' });
      isCorrect = given === correct;
      pointsEarned = isCorrect ? question.points : 0;
      gradedBy = 'AUTO';
    } else {
      // Задгай (TIMED): зөв хариулттай яг таарвал автоматаар бүтэн оноо
      const normGiven = normalizeAnswer(givenAnswer);
      const normAnswer = normalizeAnswer(question.answer);
      if (normGiven && normAnswer && normGiven === normAnswer) {
        pointsEarned = question.points;
        isCorrect = true;
        gradedBy = 'AUTO';
        feedback = 'Зөв хариулттай яг таарч байна.';
      } else {
        // Таараагүй — оноо 0, AI дараа шалгана (зураг/бодолт)
        pointsEarned = 0;
        isCorrect = false;
        gradedBy = null;
      }
    }

    const answer = await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
      update: { givenAnswer: givenAnswer ?? null, pointsEarned, isCorrect, feedback, gradedBy },
      create: {
        attemptId: attempt.id,
        questionId,
        givenAnswer: givenAnswer ?? null,
        pointsEarned,
        isCorrect,
        feedback,
        gradedBy,
      },
    });
    res.json({ answer });
  } catch (e) { next(e); }
});

// Wrong-answer review — unique incorrectly answered questions from finished attempts
router.get('/practice/wrong', async (req, res, next) => {
  try {
    const answers = await prisma.attemptAnswer.findMany({
      where: {
        isCorrect: false,
        attempt: { userId: req.user.id, finishedAt: { not: null } },
      },
      include: {
        question: {
          select: { id: true, prompt: true, topic: true, points: true, exam: { select: { title: true } } },
        },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });
    const seen = new Set();
    const questions = [];
    for (const a of answers) {
      if (!seen.has(a.question.id)) {
        seen.add(a.question.id);
        questions.push(a.question);
      }
    }
    res.json({ questions });
  } catch (e) { next(e); }
});

// AI grading — зөвхөн Задгай (open) асуултуудыг Gemini-ээр шалгана, TEST-ийг алгасна
router.post('/:id/ai-grade', async (req, res, next) => {
  try {
    const attempt = await prisma.testAttempt.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { answers: true },
    });
    if (!attempt) return res.status(404).json({ error: 'Тест олдсонгүй' });
    if (attempt.finishedAt) return res.status(400).json({ error: 'Тест аль хэдийн дууссан' });
    if (attempt.mode === 'TEST') return res.json({ graded: 0, enabled: false, reason: 'TEST mode auto-graded' });
    if (!aiConfigured()) return res.json({ graded: 0, enabled: false });

    const questions = await prisma.question.findMany({
      where: { examId: attempt.examId },
      select: {
        id: true, prompt: true, modelSolution: true,
        answer: true, points: true, type: true,
      },
    });
    const qMap = new Map(questions.map((q) => [q.id, q]));

    let graded = 0;
    for (const a of attempt.answers) {
      if (!a.givenAnswer?.trim()) continue;
      const q = qMap.get(a.questionId);
      if (!q) continue;
      if (q.type === 'test') continue; // test auto-graded
      // аль хэдийн AUTO зөв болсон бол AI дахин шалгахгүй
      if (a.gradedBy === 'AUTO' && a.isCorrect) continue;
      // normalize таарсан бол AI шаардлагагүй (answers route-д аль хэдийн бүтэн оноо өгсөн)
      if (normalizeAnswer(a.givenAnswer) === normalizeAnswer(q.answer) && q.answer) continue;
      const result = await gradeAnswer({
        prompt: q.prompt,
        modelSolution: q.modelSolution,
        answer: q.answer,
        points: q.points,
        givenAnswer: a.givenAnswer,
      });
      if (!result) continue;
      await prisma.attemptAnswer.update({
        where: { id: a.id },
        data: {
          pointsEarned: result.pointsEarned,
          isCorrect: result.isCorrect,
          feedback: result.feedback,
          gradedBy: 'AI',
        },
      });
      graded++;
    }
    res.json({ graded, enabled: true });
  } catch (e) { next(e); }
});

// Finish attempt → totals
router.post('/:id/finish', async (req, res, next) => {
  try {
    const attempt = await prisma.testAttempt.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { answers: true },
    });
    if (!attempt) return res.status(404).json({ error: 'Тест олдсонгүй' });

    const questions = await prisma.question.findMany({
      where: { examId: attempt.examId },
      select: { points: true },
    });
    const score = attempt.answers.reduce((s, a) => s + a.pointsEarned, 0);
    const totalPoints = questions.reduce((s, q) => s + q.points, 0);

    const updated = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: { score, totalPoints, finishedAt: new Date() },
    });
    res.json({ attempt: updated });
  } catch (e) { next(e); }
});

// Attempt detail with solutions (after finish) — per-attempt shuffle for test
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const attempt = await prisma.testAttempt.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        exam: { include: { program: { include: { university: true } } } },
        answers: { include: { question: true } },
      },
    });
    if (!attempt) return res.status(404).json({ error: 'Тест олдсонгүй' });

    const isTestAttempt = attempt.mode === 'TEST';
    // Shuffle choices per attempt so each student/attempt sees different order (deterministic per attemptId+questionId)
    const withShuffled = {
      ...attempt,
      answers: attempt.answers.map((a) => {
        let q = a.question;
        if (isTestAttempt && Array.isArray(q.choices) && q.choices.length === 4 && q.correctChoice) {
          const shuffled = shuffleChoicesForAttempt(q.choices, q.correctChoice, attempt.id, q.id);
          q = { ...q, choices: shuffled.choices, correctChoice: shuffled.correctChoice };
        }
        return { ...a, question: q };
      }),
    };

    // Дуусаагүй үед шийдэл/зөв хариултыг нууна — TEST-д correctChoice, Задгайд modelSolution/answer
    const hideSolutions = !attempt.finishedAt;
    const sanitized = {
      ...withShuffled,
      answers: withShuffled.answers.map((a) => (hideSolutions
        ? { ...a, question: { ...a.question, modelSolution: null, answer: null, correctChoice: null } }
        : a)),
    };
    res.json({ attempt: sanitized });
  } catch (e) { next(e); }
});

// History
router.get('/history/list', async (req, res, next) => {
  try {
    const attempts = await prisma.testAttempt.findMany({
      where: { userId: req.user.id, finishedAt: { not: null } },
      orderBy: { finishedAt: 'desc' },
      include: { exam: { select: { title: true, year: true, variant: true } } },
    });
    res.json({ attempts });
  } catch (e) { next(e); }
});

// Topic progress dashboard (anonymized aggregate basis for admin stats too)
router.get('/progress/topics', async (req, res, next) => {
  try {
    const rows = await prisma.attemptAnswer.groupBy({
      by: ['questionId'],
      where: { attempt: { userId: req.user.id, finishedAt: { not: null } } },
      _sum: { pointsEarned: true },
      _count: { _all: true },
    });
    const qIds = rows.map((r) => r.questionId);
    const questions = await prisma.question.findMany({
      where: { id: { in: qIds } },
      select: { id: true, points: true, tags: true, topic: true },
    });
    const byTopic = {};
    const qMap = Object.fromEntries(questions.map((q) => [q.id, q]));
    for (const r of rows) {
      const q = qMap[r.questionId];
      if (!q) continue;
      const topics = q.topic ? [q.topic] : q.tags.length ? [q.tags[0]] : ['Бусад'];
      for (const t of topics) {
        byTopic[t] ??= { earned: 0, possible: 0 };
        byTopic[t].earned += r._sum.pointsEarned ?? 0;
        byTopic[t].possible += q.points * r._count._all;
      }
    }
    const topics = Object.entries(byTopic)
      .map(([topic, v]) => ({
        topic,
        percent: v.possible ? Math.round((v.earned / v.possible) * 100) : 0,
        earned: v.earned,
        possible: v.possible,
      }))
      .sort((a, b) => b.percent - a.percent);
    res.json({ topics });
  } catch (e) { next(e); }
});

export default router;
