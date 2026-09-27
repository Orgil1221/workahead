import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Public program list (register page) — no auth
router.get('/programs-public', async (_req, res, next) => {
  try {
    const universities = await prisma.university.findMany({
      orderBy: { name: 'asc' },
      include: { programs: { orderBy: { order: 'asc' } } },
    });
    const programs = universities.flatMap((u) =>
      u.programs.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        school: p.school,
        universityName: u.shortName || u.name,
      }))
    );
    // Админы тогтоосон landing theme — default 'auto' (УБ цаг агаар)
    const themeRow = await prisma.siteSetting.findUnique({ where: { key: 'landingTheme' } }).catch(() => null);
    res.json({ programs, landingTheme: themeRow?.value || 'auto' });
  } catch (e) { next(e); }
});

// Drill-down catalog: University → Program → (exam counts)
router.get('/catalog', requireAuth, async (_req, res, next) => {
  try {
    const universities = await prisma.university.findMany({
      orderBy: { name: 'asc' },
      include: {
        programs: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { exams: true, students: true } } },
        },
      },
    });
    res.json({ universities });
  } catch (e) { next(e); }
});

router.get('/programs/:id/exams', requireAuth, async (req, res, next) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { programId: req.params.id },
      orderBy: [{ year: 'desc' }, { order: 'asc' }],
      include: { _count: { select: { questions: true } } },
    });
    res.json({ exams });
  } catch (e) { next(e); }
});

export default router;
