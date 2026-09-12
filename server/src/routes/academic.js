import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { MUIS_ACADEMIC_MAJORS } from '../data/muisAcademicMajors.js';

const router = Router();

// Public — бүртгэлийн салбар сургууль / хөтөлбөр жагсаалт (exam Program-аас тусдаа)
// ХОРИГЛОНО: шалгалтын Program-оос fallback хийхгүй — fallback нь шалгалтын хичээлүүдийг
// бүртгэлийн салбар/хөтөлбөрийн dropdown-д холих асуудал үүсгэсэн (жишээ: school="МУИС" хичээл).
router.get('/academic-programs', async (_req, res, next) => {
  try {
    const programs = await prisma.academicProgram.findMany({
      orderBy: [{ university: 'asc' }, { school: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    });
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
      include: { _count: { select: { students: true } } },
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

admin.post('/seed', async (_req, res, next) => {
  try {
    // АЛБАН ЁСНЫ жагсаалт — МУИС-ий элсэлтийн системээс гаргаж авсан (src/data/muisAcademicMajors.js)
    const academicMajors = MUIS_ACADEMIC_MAJORS;
    let created = 0;
    for (let i = 0; i < academicMajors.length; i++) {
      const m = academicMajors[i];
      await prisma.academicProgram.upsert({
        where: { university_school_name: { university: 'МУИС', school: m.school, name: m.name } },
        update: { code: m.code, order: i + 1 },
        create: { university: 'МУИС', school: m.school, name: m.name, code: m.code, order: i + 1 },
      });
      created++;
    }
    // Жагсаалтад байхгүй хуучин/буруу МУИС бүртгэлийг цэвэрлэх (жишээ: бүртгэлийн үед
    // fallback-аар үүссэн {school: "МУИС"} бүртгэл — npm run seed-ийн цэвэрлэгээтэй ижил логик)
    const newKeys = new Set(academicMajors.map((m) => `${m.school}::${m.name}`));
    const allAcad = await prisma.academicProgram.findMany({ where: { university: 'МУИС' }, select: { id: true, school: true, name: true } });
    let removed = 0;
    for (const a of allAcad) {
      if (!newKeys.has(`${a.school}::${a.name}`)) {
        await prisma.academicProgram.delete({ where: { id: a.id } });
        removed++;
      }
    }
    const count = await prisma.academicProgram.count();
    res.json({ ok: true, created, removed, count });
  } catch (e) { next(e); }
});

export { router as academicRouter, admin as academicAdminRouter };
