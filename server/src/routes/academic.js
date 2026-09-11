import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

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
    const academicMajors = [
      { code: 'CS101', name: 'Компьютерын ухаан', school: 'МТЭС' },
      { code: 'SE101', name: 'Программ хангамж', school: 'МТЭС' },
      { code: 'IS101', name: 'Мэдээллийн систем', school: 'МТЭС' },
      { code: 'AI101', name: 'Хиймэл оюун', school: 'МТЭС' },
      { code: 'CN101', name: 'Компьютерын сүлжээ', school: 'МТЭС' },
      { code: 'EE101', name: 'Электроникийн инженерчлэл', school: 'МТЭС' },
      { code: 'MATH201', name: 'Математик', school: 'ШУС' },
      { code: 'PHYS201', name: 'Физик', school: 'ШУС' },
      { code: 'CHEM201', name: 'Хими', school: 'ШУС' },
      { code: 'BIO201', name: 'Биологи', school: 'ШУС' },
      { code: 'GEO201', name: 'Газарзүй', school: 'ШУС' },
      { code: 'GEOL201', name: 'Геологи', school: 'ШУС' },
      { code: 'ORON101', name: 'Орон судлал', school: 'ШУС' },
      { code: 'HIST201', name: 'Түүх', school: 'ШУС' },
      { code: 'SOC201', name: 'Социологи', school: 'ШУС' },
      { code: 'PHIL201', name: 'Философи', school: 'ШУС' },
      { code: 'PSY201', name: 'Сэтгэл судлал', school: 'ШУС' },
      { code: 'TEA101', name: 'Багш, Сурган судлал', school: 'ШУС' },
      { code: 'TEA102', name: 'Монгол хэл, уран зохиолын багш', school: 'ШУС' },
      { code: 'TEA103', name: 'Англи хэлний багш', school: 'ШУС' },
      { code: 'TEA104', name: 'Математикийн багш', school: 'ШУС' },
      { code: 'FIN101', name: 'Санхүү, банк', school: 'БС' },
      { code: 'ACC101', name: 'Нягтлан бодох бүртгэл', school: 'БС' },
      { code: 'MNG101', name: 'Менежмент', school: 'БС' },
      { code: 'MKT101', name: 'Маркетинг', school: 'БС' },
      { code: 'TRD101', name: 'Худалдаа', school: 'БС' },
      { code: 'LAW101', name: 'Эрх зүй', school: 'ХЗС' },
      { code: 'CE301', name: 'Барилгын инженер', school: 'ИТС' },
      { code: 'ME301', name: 'Механик инженер', school: 'ИТС' },
      { code: 'EL301', name: 'Цахилгаан инженер', school: 'ИТС' },
      { code: 'CHE301', name: 'Химийн инженерчлэл', school: 'ИТС' },
      { code: 'ENV301', name: 'Хүрээлэн буй орчны инженерчлэл', school: 'ИТС' },
      { code: 'IR401', name: 'Олон улсын харилцаа', school: 'УТСОУХНУС' },
      { code: 'PS401', name: 'Улс төр судлал', school: 'УТСОУХНУС' },
      { code: 'PA401', name: 'Нийтийн удирдлага', school: 'УТСОУХНУС' },
    ];
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
