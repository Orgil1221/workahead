import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MUIS_ACADEMIC_MAJORS } from '../src/data/muisAcademicMajors.js';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import-format JSON → Exam + Questions (same shape as admin Content Import)
  const importedExamIds = [];
  const importedExamYears = new Map();
  async function importFile(filePath, programId) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data || !Array.isArray(data.questions) || !data.questions.every((q) => typeof q.prompt === 'string' && q.prompt.trim())) {
    throw new Error('Seed exam must contain a questions array with non-empty prompts');
  }
  const questionRows = data.questions.map((q, i) => ({
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
  }));
  const exam = await prisma.$transaction(async (tx) => {
    const savedExam = await tx.exam.upsert({
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
    await tx.question.deleteMany({ where: { examId: savedExam.id } });
    await tx.question.createMany({ data: questionRows.map((question) => ({ ...question, examId: savedExam.id })) });
    return savedExam;
  });
  console.log(`  ✓ ${exam.code}: ${data.questions.length} асуулт`);
  importedExamIds.push(exam.id);
  importedExamYears.set(exam.id, Number(data.year));
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const studentEmail = process.env.SEED_STUDENT_EMAIL?.trim().toLowerCase();
  const studentPassword = process.env.SEED_STUDENT_PASSWORD;
  if (Boolean(adminEmail) !== Boolean(adminPassword) || Boolean(studentEmail) !== Boolean(studentPassword)) {
    throw new Error('Seed account email/password variables must be configured in pairs');
  }
  if (process.env.NODE_ENV === 'production' && (!adminEmail || adminPassword.length < 16)) {
    throw new Error('Production seed requires SEED_ADMIN_EMAIL and a unique SEED_ADMIN_PASSWORD of at least 16 characters');
  }
  if (adminPassword && adminPassword.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters');
  if (studentPassword && studentPassword.length < 12) throw new Error('SEED_STUDENT_PASSWORD must be at least 12 characters');

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
  // --- Шалгалтын Program: хуучин 40 мэргэжлийн seed устгах (зөвхөн хичээл үлдэнэ) ---
  // -law101 гэх мэт хуучин prog-* ID-тай Program-ууд шалгалтын ангилалд хамаарахгүй тул цэвэрлэнэ
  const deletedOld = await prisma.program.deleteMany({ where: { id: { startsWith: 'prog-' } } });
  if (deletedOld.count) console.log(`  ✗ Хуучин Program мэргэжил ${deletedOld.count} устгалаа (шалгалтын Program-аас тусдаа болгох)`);
  // Давтагдаагүй хуучин Program-ууд (prog- биш) байвал давхцлыг шалгаж цэвэрлэнэ
  // (Хоосон үлдээх — шалгалтын Program-д зөвхөн seed-program-math хичээл байх ёстой)
  console.log(`  ✓ Шалгалтын Program цэвэр — зөвхөн хичээлүүд үлдлээ`);

  // --- Бүртгэлийн AcademicProgram — АЛБАН ЁСНЫ жагсаалт (МУИС элсэлтийн системээс) ---
  const academicMajors = MUIS_ACADEMIC_MAJORS;
  // Давхцсан хуучин AcademicProgram-ууд байвал шинэчлэх, шинэ дутуу нь нэмэгдэнэ
  for (let i = 0; i < academicMajors.length; i++) {
    const m = academicMajors[i];
    await prisma.academicProgram.upsert({
      where: { university_school_name: { university: 'МУИС', school: m.school, name: m.name } },
      update: { code: m.code, order: i + 1 },
      create: { university: 'МУИС', school: m.school, name: m.name, code: m.code, order: i + 1 },
    });
  }
  // Хуучин AcademicProgram дотроос шинэ жагсаалтад байхгүй, давхцсан хуучин нэрс байвал устгах (давхцал цэвэрлэх)
  const newKeys = new Set(academicMajors.map((m) => `${m.school}::${m.name}`));
  const allAcad = await prisma.academicProgram.findMany({ where: { university: 'МУИС' }, select: { id: true, school: true, name: true } });
  let removedDup = 0;
  for (const a of allAcad) {
    if (!newKeys.has(`${a.school}::${a.name}`)) {
      await prisma.academicProgram.delete({ where: { id: a.id } });
      removedDup++;
    }
  }
  if (removedDup) console.log(`  ✗ Хуучин AcademicProgram давхцал ${removedDup} устгалаа`);
  const acadCount = await prisma.academicProgram.count();
  console.log(`  ✓ AcademicProgram (бүртгэлийн салбар/хөтөлбөр) ${acadCount} — Улаанбаатар МУИС 6 салбар (МТЭС/ШУС/БС/ХЗС/ИТС/УТСОУХНУС) + Орон судлал/Багш нэмсэн, шалгалтын Program-аас тусдаа`);

  if (adminEmail) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, role: 'ADMIN', isVerified: true, isActive: true },
      create: { email: adminEmail, passwordHash, name: 'Админ', role: 'ADMIN', isVerified: true },
    });
  }
  let student = null;
  if (studentEmail) {
    const passwordHash = await bcrypt.hash(studentPassword, 12);
    student = await prisma.user.upsert({
      where: { email: studentEmail },
      update: { isVerified: true },
      create: { email: studentEmail, passwordHash, name: 'Оюутан Тэмүүлэн', role: 'STUDENT', programId: program.id, isVerified: true },
    });
  }

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
  if (adminEmail) console.log(`  Админ үүсгэв: ${adminEmail}`);
  if (student) console.log(`  Демо оюутан үүсгэв: ${student.email} (${student.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
