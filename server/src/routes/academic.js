import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public — бүртгэлийн салбар сургууль / хөтөлбөр жагсаалт (exam Program-аас тусдаа)
router.get('/academic-programs', async (_req, res, next) => {
  try {
    const programs = await prisma.academicProgram.findMany({
      orderBy: [{ university: 'asc' }, { school: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    });
    // Group by university + school for frontend convenience
    const bySchool = {};
    for (const p of programs) {
      if (!bySchool[p.school]) bySchool[p.school] = [];
      bySchool[p.school].push(p);
    }
    res.json({ programs, bySchool });
  } catch (e) { next(e); }
});

// Admin — CRUD (тусдаа, exam catalog-д нөлөөлөхгүй)
const admin = Router();
admin.use(requireAuth, requireAdmin);

admin.get('/', async (_req, res, next) => {
  try {
    const programs = await prisma.academicProgram.findMany({
      orderBy: [{ university: 'asc' }, { school: 'asc' }, { order: 'asc' }],
    });
    res.json({ programs });
  } catch (e) { next(e); }
});

admin.post('/', async (req, res, next) => {
  try {
    const { university, school, name, code, order } = req.body;
    if (!university?.trim() || !school?.trim() || !name?.trim()) {
      return res.status(400).json({ error: 'Их сургууль, салбар, хөтөлбөрийн нэр шаардлагатай' });
    }
    const prog = await prisma.academicProgram.create({
      data: {
        university: university.trim(),
        school: school.trim(),
        name: name.trim(),
        code: code?.trim() || null,
        order: order ? Number(order) : 0,
      },
    });
    res.status(201).json({ program: prog });
  } catch (e) { next(e); }
});

admin.put('/:id', async (req, res, next) => {
  try {
    const { university, school, name, code, order } = req.body;
    const prog = await prisma.academicProgram.update({
      where: { id: req.params.id },
      data: {
        ...(university !== undefined && { university: university.trim() }),
        ...(school !== undefined && { school: school.trim() }),
        ...(name !== undefined && { name: name.trim() }),
        ...(code !== undefined && { code: code?.trim() || null }),
        ...(order !== undefined && { order: Number(order) }),
      },
    });
    res.json({ program: prog });
  } catch (e) { next(e); }
});

admin.delete('/:id', async (req, res, next) => {
  try {
    await prisma.academicProgram.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export { router as academicRouter, admin as academicAdminRouter };
