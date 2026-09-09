import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import-format JSON → Exam + Questions (same shape as admin Content Import)
  const importedExamIds = [];
  const importedExamYears = new Map();
  async function importFile(filePath, programId) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const exam = await prisma.exam.upsert({
    where: { code: data.exam_id },
    update: {
      title: data.title, source: data.source ?? null, year: Number(data.year),
      variant: data.variant ?? null, programId,
    },
    create: {
      code: data.exam_id, title: data.title, source: data.source ?? null,
      year: Number(data.year), variant: data.variant ?? null, programId,
    },
  });
  await prisma.question.deleteMany({ where: { examId: exam.id } });
  await prisma.question.createMany({
    data: data.questions.map((q, i) => ({
      examId: exam.id,
      order: i + 1,
      type: q.type ?? 'open',
      topic: q.topic ?? q.tags?.[0] ?? null,
      level: q.level ?? null,
      year: q.year ?? Number(data.year),
      source: q.source ?? data.source ?? null,
      prompt: q.prompt,
      modelSolution: q.model_solution ?? null,
      answer: q.answer ?? null,
      points: Number(q.points ?? 1),
      needsReview: Boolean(q.needs_review ?? false),
      tags: Array.isArray(q.tags) ? q.tags : [],
    })),
  });
  console.log(`  ✓ ${exam.code}: ${data.questions.length} асуулт`);
  importedExamIds.push(exam.id);
  importedExamYears.set(exam.id, Number(data.year));
}

async function main() {
  // --- Users ---
  const passwordHash = await bcrypt.hash('admin123', 10);
  const studentHash = await bcrypt.hash('student123', 10);

  const [university] = await Promise.all([
    prisma.university.upsert({
      where: { name: 'Монголын Их Сургууль' },
      update: { shortName: 'МУИС' },
      create: { name: 'Монголын Их Сургууль', shortName: 'МУИС' },
    }),
  ]);

  const program = await prisma.program.upsert({
    where: { id: 'seed-program-math' },
    // Хичээлийн сав програм — сургууль салгасан тул мэргэжлийн жагсаалтад огт орохгүй,
    // зөвхөн шалгалтын каталог дээр хичээл болон харагдана
    update: { universityId: university.id, school: null },
    create: { id: 'seed-program-math', name: 'Нэг хувьсагчийн функцийн онол 1Б', school: null, universityId: university.id, order: 1 },
  });

  // --- МУИС 40 мэргэжил — салбар сургуулиар ангилсан (үнэн зөв, үсгийн алдаагүй) ---
  const majors = [
    // МТЭС — 12
    { code: 'CS101', name: 'Компьютерын ухаан', school: 'МТЭС' },
    { code: 'MMT101', name: 'Мультимедиа технологи', school: 'МТЭС' },
    { code: 'IS101', name: 'Мэдээллийн систем', school: 'МТЭС' },
    { code: 'IT101', name: 'Мэдээллийн технологи', school: 'МТЭС' },
    { code: 'SE101', name: 'Программ хангамж', school: 'МТЭС' },
    { code: 'AI101', name: 'Хиймэл оюун', school: 'МТЭС' },
    { code: 'CN101', name: 'Компьютерын сүлжээ', school: 'МТЭС' },
    { code: 'CT101', name: 'Холбооны технологи', school: 'МТЭС' },
    { code: 'EE101', name: 'Электроникийн инженерчлэл', school: 'МТЭС' },
    { code: 'CE101', name: 'Компьютерын инженерчлэл', school: 'МТЭС' },
    { code: 'ST101', name: 'Статистик', school: 'МТЭС' },
    { code: 'AM101', name: 'Хэрэглээний математик', school: 'МТЭС' },
    // БС — 7
    { code: 'FIN101', name: 'Санхүү, банк', school: 'БС' },
    { code: 'ACC101', name: 'Нягтлан бодох бүртгэл', school: 'БС' },
    { code: 'MKT101', name: 'Маркетинг', school: 'БС' },
    { code: 'MNG101', name: 'Менежмент', school: 'БС' },
    { code: 'HOS101', name: 'Зочлох үйлчилгээ', school: 'БС' },
    { code: 'TRD101', name: 'Худалдаа', school: 'БС' },
    { code: 'INS101', name: 'Даатгал', school: 'БС' },
    // ХЗС — 2
    { code: 'LAW101', name: 'Эрх зүй', school: 'ХЗС' },
    { code: 'LAW102', name: 'Олон улсын эрх зүй', school: 'ХЗС' },
    // ШУС — Байгалийн ухаан — 6
    { code: 'MATH201', name: 'Математик', school: 'ШУС' },
    { code: 'PHYS201', name: 'Физик', school: 'ШУС' },
    { code: 'CHEM201', name: 'Хими', school: 'ШУС' },
    { code: 'BIO201', name: 'Биологи', school: 'ШУС' },
    { code: 'GEO201', name: 'Газарзүй', school: 'ШУС' },
    { code: 'GEOL201', name: 'Геологи', school: 'ШУС' },
    // ШУС — Хүмүүнлэг — 6
    { code: 'HIST201', name: 'Түүх', school: 'ШУС' },
    { code: 'ARCH201', name: 'Археологи', school: 'ШУС' },
    { code: 'SOC201', name: 'Социологи', school: 'ШУС' },
    { code: 'PHIL201', name: 'Философи', school: 'ШУС' },
    { code: 'PSY201', name: 'Сэтгэл судлал', school: 'ШУС' },
    { code: 'LIT201', name: 'Утга зохиол судлал', school: 'ШУС' },
    // ИТС — 5
    { code: 'CE301', name: 'Барилгын инженер', school: 'ИТС' },
    { code: 'ME301', name: 'Механик инженер', school: 'ИТС' },
    { code: 'EL301', name: 'Цахилгаан инженер', school: 'ИТС' },
    { code: 'ENV301', name: 'Хүрээлэн буй орчны инженерчлэл', school: 'ИТС' },
    { code: 'CHE301', name: 'Химийн инженерчлэл', school: 'ИТС' },
    // УТСОУХНУС — 3
    { code: 'IR401', name: 'Олон улсын харилцаа', school: 'УТСОУХНУС' },
    { code: 'PS401', name: 'Улс төр судлал', school: 'УТСОУХНУС' },
    { code: 'PA401', name: 'Нийтийн удирдлага', school: 'УТСОУХНУС' },
  ];
  for (let i = 0; i < majors.length; i++) {
    const m = majors[i];
    const id = `prog-${m.code.toLowerCase()}`; // кодыг зөвхөн тогтмол ID үүсгэхэд ашиглана — DB-д бичигдэхгүй
    await prisma.program.upsert({
      where: { id },
      update: { name: m.name, school: m.school, universityId: university.id, order: i + 2 },
      create: { id, name: m.name, school: m.school, universityId: university.id, order: i + 2 },
    });
  }
  console.log(`  ✓ ${majors.length} мэргэжил (МТЭС/БС/ХЗС/ШУС/ИТС/УТСОУХНУС) шинэчлэгдлээ`);

  // --- Бүртгэлийн AcademicProgram — шалгалтын Program-аас тусдаа ---
  for (let i = 0; i < majors.length; i++) {
    const m = majors[i];
    await prisma.academicProgram.upsert({
      where: { university_school_name: { university: 'МУИС', school: m.school, name: m.name } },
      update: { code: m.code, order: i + 1 },
      create: { university: 'МУИС', school: m.school, name: m.name, code: m.code, order: i + 1 },
    });
  }
  const acadCount = await prisma.academicProgram.count();
  console.log(`  ✓ AcademicProgram (бүртгэлийн салбар/хөтөлбөр) ${acadCount} — шалгалтын Program-аас тусдаа`);

  await prisma.user.upsert({
    where: { email: 'admin@workahead.mn' },
    update: { isVerified: true },
    create: { email: 'admin@workahead.mn', passwordHash, name: 'Админ', role: 'ADMIN', isVerified: true },
  });
  const student = await prisma.user.upsert({
    where: { email: 'student@workahead.mn' },
    update: { isVerified: true },
    create: { email: 'student@workahead.mn', passwordHash: studentHash, name: 'Оюутан Тэмүүлэн', role: 'STUDENT', programId: program.id, isVerified: true },
  });

  // --- Import seed files (files/*.json) ---
  const filesDir = process.env.SEED_FILES_DIR || path.resolve(__dirname, '../../files');
  if (fs.existsSync(filesDir)) {
    const jsons = fs.readdirSync(filesDir).filter((f) => f.endsWith('.json')).sort();
    for (const f of jsons) {
      try { await importFile(path.join(filesDir, f), program.id); }
      catch (e) { console.error(`  ✗ ${f}: ${e.message}`); }
    }
  } else {
    console.log(`(files хавтас олдсонгүй: ${filesDir})`);
  }

  // --- Demo payment plan (Bonum integration) — 30 хоног 6999₮ ---
  if (importedExamIds.length > 0) {
    const plan = await prisma.plan.upsert({
      where: { code: 'seasonal-math1b' },
      update: { priceMnt: 6999, durationDays: 30, title: '30 хоногийн багц', description: 'Бүх шалгалт — Задгай + Тест, иж бүрэн шийдэл, AI үнэлгээ — 30 хоногийн эрх' },
      create: {
        code: 'seasonal-math1b',
        title: '30 хоногийн багц',
        description: 'Бүх шалгалт — Задгай + Тест, иж бүрэн шийдэл, AI үнэлгээ — 30 хоногийн эрх',
        priceMnt: 6999,
        durationDays: 30,
      },
    });
    await prisma.planExam.createMany({
      data: importedExamIds.map((examId) => ({ planId: plan.id, examId })),
      skipDuplicates: true,
    });
    console.log(`  ✓ Багц '${plan.title}' — ${importedExamIds.length} шалгалт, ${plan.priceMnt}₮`);

    // Хичээл бүрийн хамгийн эртний шалгалт — үнэгүй урьдчилж харах
    await prisma.exam.updateMany({
      where: { id: { in: importedExamIds } },
      data: { isFree: false },
    });
    const oldest = [...importedExamYears.entries()].sort((a, b) => a[1] - b[1])[0][0];
    await prisma.exam.update({ where: { id: oldest }, data: { isFree: true } });
    console.log('  ✓ Эхний шалгалт (хамгийн эртний он) — бүх хэрэглэгчид үнэгүй');
  }

  console.log('\nSeed дууслаа.');
  console.log('  Админ:   admin@workahead.mn / admin123');
  console.log(`  Оюутан:  student@workahead.mn / student123 (${student.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
