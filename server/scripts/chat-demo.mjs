import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

if (process.env.NODE_ENV === 'production') throw new Error('Local demo only');
const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = resolve(process.argv[2] || join(tmpdir(), 'workahead-chat-local'));
const requireDemo = createRequire(join(demoDir, 'package.json'));
const { PGlite } = requireDemo('@electric-sql/pglite');
const { PGLiteSocketServer } = requireDemo('@electric-sql/pglite-socket');
const requireServer = createRequire(join(serverDir, 'package.json'));
const bcrypt = requireServer('bcryptjs');
const prismaCli = join(serverDir, 'node_modules/prisma/build/index.js');
const schema = join(serverDir, 'prisma/schema.prisma');
await mkdir(join(demoDir, 'data'), { recursive: true });
const db = await PGlite.create(join(demoDir, 'data'));
const initialized = await db.query(`SELECT to_regclass('public."User"') AS existing`);
if (!initialized.rows[0].existing) {
  const sql = execFileSync(process.execPath, [prismaCli, 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schema, '--script'], { cwd: serverDir, encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://local:local@127.0.0.1:5444/postgres' } });
  await db.exec(sql);
}
const passwordHash = await bcrypt.hash('ChatLocal2026!', 10);
const identifiers = { university: 'chat-demo-university', program: 'chat-demo-program', exam: 'chat-demo-exam', question: 'chat-demo-question', plan: 'chat-demo-plan' };
await db.query(`INSERT INTO "University" (id, name, "shortName") VALUES ($1, 'Chat demo их сургууль', 'МУИС') ON CONFLICT (id) DO NOTHING`, [identifiers.university]);
await db.query(`INSERT INTO "Program" (id, "universityId", name, school) VALUES ($1,$2,'Математик 1Б','МТЭС') ON CONFLICT (id) DO NOTHING`, [identifiers.program, identifiers.university]);
for (const [code, name] of [['МТЭС', 'Программ хангамж'], ['ХУС', 'Эрх зүй'], ['БУС', 'Бизнесийн удирдлага']]) {
  await db.query(`INSERT INTO "AcademicProgram" (id, university, school, name) VALUES ($1,'МУИС',$2,$3) ON CONFLICT (id) DO NOTHING`, ['chat-school-' + code, code, name]);
}
const people = [
  ['chat-temuulen', 'temuulen@local.workahead', 'Тэмүүлэн', 'STUDENT', 'МТЭС'],
  ['chat-nomin', 'nomin@local.workahead', 'Номин', 'STUDENT', 'ХУС'],
  ['chat-bat', 'bat@local.workahead', 'Бат-Эрдэнэ', 'STUDENT', 'БУС'],
  ['chat-expired', 'expired@local.workahead', 'Саруул', 'STUDENT', 'МТЭС'],
  ['chat-admin', 'admin@local.workahead', 'WorkAhead', 'ADMIN', 'МТЭС'],
];
for (const [id, email, name, role, school] of people) {
  await db.query(`INSERT INTO "User" (id, email, name, role, "passwordHash", "isVerified", "academicProgramId") VALUES ($1,$2,$3,$4,$5,true,$6) ON CONFLICT (id) DO NOTHING`, [id, email, name, role, passwordHash, 'chat-school-' + school]);
}
await db.query(`INSERT INTO "Plan" (id, code, title, "priceMnt", "durationDays") VALUES ($1,'CHAT-DEMO','Бэлтгэлийн багц',6999,30) ON CONFLICT (id) DO NOTHING`, [identifiers.plan]);
await db.query(`INSERT INTO "PaymentTransaction" (id,"userId","planId","transactionId",amount,status,"expiresAt") VALUES ('chat-demo-payment','chat-temuulen',$1,'chat-demo-local-only',6999,'PAID',NOW()+INTERVAL '30 days') ON CONFLICT (id) DO NOTHING`, [identifiers.plan]);
await db.query(`INSERT INTO "Exam" (id,"programId",code,title,year,"isFree") VALUES ($1,$2,'CHAT-DEMO-EXAM','Математик 1Б — Жишээ шалгалт',2026,true) ON CONFLICT (id) DO NOTHING`, [identifiers.exam, identifiers.program]);
await db.query(`INSERT INTO "Question" (id,"examId",prompt,answer,points,topic) VALUES ($1,$2,'2 + 2 = ?', '4', 10,'Алгебр') ON CONFLICT (id) DO NOTHING`, [identifiers.question, identifiers.exam]);
await db.query(`INSERT INTO "Question" (id,"examId","order",type,topic,prompt,answer,"modelSolution",points) VALUES ('chat-demo-latex-question',$1,1,'open','Интеграл',$2,'12',$3,2) ON CONFLICT (id) DO NOTHING`, [identifiers.exam, '$$\\int_{0}^{2} (3x^{2} + 2x)\\,dx$$ интегралын утгыг ол.', '$$[x^{3}+x^{2}]_{0}^{2}=8+4=12$$']);
for (let index = 0; index < 14; index++) {
  const finished = new Date(Date.now() - index * 86400000 - 3600000);
  await db.query(`INSERT INTO "TestAttempt" (id,"userId","examId",mode,format,score,"totalPoints","startedAt","finishedAt") VALUES ($1,'chat-temuulen',$2,'TEST','TEST',$3,10,$4,$5) ON CONFLICT (id) DO NOTHING`, ['chat-attempt-' + index, identifiers.exam, index === 0 ? 10 : 7, new Date(finished.getTime() - 1200000), finished]);
  await db.query(`INSERT INTO "AttemptAnswer" (id,"attemptId","questionId","givenAnswer","pointsEarned","isCorrect") VALUES ($1,$2,$3,'4',10,true) ON CONFLICT (id) DO NOTHING`, ['chat-answer-' + index, 'chat-attempt-' + index, identifiers.question]);
}
await db.query(`INSERT INTO "ChatProfile" ("userId","selectedBadge") VALUES ('chat-temuulen','rank') ON CONFLICT ("userId") DO NOTHING`);
await db.query(`INSERT INTO "ChatRoom" (id,kind) VALUES ('all','PUBLIC') ON CONFLICT (id) DO NOTHING`);
await db.query(`INSERT INTO "PaymentTransaction" (id,"userId","planId","transactionId",amount,status,"expiresAt") VALUES ('chat-expired-payment','chat-expired',$1,'chat-expired-local-only',6999,'PAID',NOW()-INTERVAL '1 day') ON CONFLICT (id) DO NOTHING`, [identifiers.plan]);
await db.query(`INSERT INTO "ChatRoom" (id,kind,"pairKey") VALUES ('chat-demo-expired-room','DIRECT','chat-expired:chat-nomin') ON CONFLICT (id) DO NOTHING`);
for (const userId of ['chat-expired', 'chat-nomin']) await db.query(`INSERT INTO "ChatMember" ("roomId","userId") VALUES ('chat-demo-expired-room',$1) ON CONFLICT DO NOTHING`, [userId]);
await db.query(`INSERT INTO "ChatInvite" (id,"senderId","recipientId","pairKey",status,"updatedAt","roomId") VALUES ('chat-demo-expired-invite','chat-expired','chat-nomin','chat-expired:chat-nomin','ACCEPTED',NOW(),'chat-demo-expired-room') ON CONFLICT (id) DO NOTHING`);
const sampleMessages = [
  ['chat-admin', 'Тавтай морил! 👋\nЭнд шалгалтын бэлтгэл, бодлого болон хэрэгтэй зөвлөгөөгөө хуваалцаарай. Бие биедээ хүндэтгэлтэй хандъя.'],
  ['chat-nomin', 'Сайн уу! Математик 1Б-ийн хязгаар дээр хамт бэлдэх хүн байна уу?'],
  ['chat-temuulen', 'Байна аа 🙌 Эхлээд өмнөх шалгалтын бодлогуудаа хамт үзье.'],
  ['chat-bat', 'Би ч бас нэгдье. Өчигдөр дүнгийн түүхээсээ алдсан бодлогоо хараад давтсан, их хэрэгтэй юм байна.'],
  ['chat-nomin', 'Гоё! Тэмүүлэн, чиний #1 badge ямар шалгуураар нээгддэг вэ?'],
  ['chat-temuulen', 'Дуусгасан шалгалтын тоогоор эхний 10-т орвол авдаг. Профайл дээр өөр badge-аа ч сонгож болно ✦'],
];
for (let index = 0; !initialized.rows[0].existing && index < sampleMessages.length; index++) {
  await db.query(`INSERT INTO "ChatMessage" (id,"roomId","userId","clientId",body,"createdAt") VALUES ($1,'all',$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, ['chat-welcome-' + index, sampleMessages[index][0], randomUUID(), sampleMessages[index][1], new Date(Date.now() - (sampleMessages.length - index) * 120000)]);
}
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 5444 });
await socket.start();
const child = spawn(process.execPath, ['src/index.js'], { cwd: serverDir, stdio: 'inherit', env: {
  ...process.env, DOTENV_CONFIG_PATH: join(demoDir, 'no-production-env'), NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '4001',
  DATABASE_URL: 'postgresql://local:local@127.0.0.1:5444/postgres?connection_limit=1',
  JWT_SECRET: 'workahead-isolated-local-chat-demo-only', CSRF_SECRET: 'workahead-isolated-local-chat-csrf-only',
  CHAT_LOCAL_DEMO: '1', CORS_ORIGIN: 'http://localhost:5174,http://127.0.0.1:5174', REDIS_URL: '',
  RESEND_API_KEY: '', SMTP_HOST: '', VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '',
} });
child.on('exit', async (code) => { await socket.stop(); await db.close(); process.exit(code || 0); });
process.on('SIGINT', () => child.kill());
console.log('Isolated Chat demo: API 4001, PostgreSQL 5444. Password: ChatLocal2026!');
