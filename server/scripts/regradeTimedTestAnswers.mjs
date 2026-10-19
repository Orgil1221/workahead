// TIMED горимд тест бодлогын буруу тавигдсан оноог дахин тооцно.
// Шалтгаан: shuffle нэвтрэхээс (2026-09-09) хойш шалгалтын дэлгэц сонголтыг хольдог байсан ч
// TIMED горимд шалгалт нь хуучин (холиогүй) үсгээр шалгаж, review нь холиогүй харуулж байсан.
// Одоо code fix-тэй ижил (attemptId+questionId seed) shuffle-ээр дахин тооцно.
//
// Ашиглалт: DATABASE_URL=<prod> node scripts/regradeTimedTestAnswers.mjs           (dry-run)
//           DATABASE_URL=<prod> node scripts/regradeTimedTestAnswers.mjs --apply   (бичих)
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { shuffleChoicesForAttempt } from '../src/services/shuffle.js';

const APPLY = process.argv.includes('--apply');
// Shuffle commit 3dc0e8c deployed at 2026-09-09 01:40 +0800 — from then on display was shuffled
const SHUFFLE_EPOCH = new Date('2026-09-09T01:40:00+08:00');

const prisma = new PrismaClient();

const attempts = await prisma.testAttempt.findMany({
  where: { mode: 'TIMED' },
  include: { answers: { include: { question: true } } },
});

let scanned = 0, skippedOld = 0, regraded = 0, changedAttempts = 0;

for (const attempt of attempts) {
  if (attempt.startedAt < SHUFFLE_EPOCH) { skippedOld++; continue; }
  let attemptChanged = false;
  for (const answer of attempt.answers) {
    const q = answer.question;
    if (q.type !== 'test') continue;
    if (!Array.isArray(q.choices) || q.choices.length !== 4 || !q.correctChoice) continue;
    const given = String(answer.givenAnswer || '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(given)) continue;
    scanned++;
    const shuffled = shuffleChoicesForAttempt(q.choices, q.correctChoice, attempt.id, q.id);
    const correct = String(shuffled.correctChoice || '').toUpperCase();
    if (!correct) continue;
    const isCorrect = given === correct;
    const pointsEarned = isCorrect ? q.points : 0;
    if (answer.isCorrect === isCorrect && answer.pointsEarned === pointsEarned) continue;
    attemptChanged = true;
    regraded++;
    console.log(`${APPLY ? 'FIX' : 'WOULD FIX'} attempt=${attempt.id} q=${q.id} given=${given} correct=${correct} ${answer.isCorrect}->${isCorrect}`);
    if (APPLY) {
      await prisma.attemptAnswer.update({
        where: { id: answer.id },
        data: { isCorrect, pointsEarned, gradedBy: 'AUTO' },
      });
    }
  }
  if (attemptChanged && attempt.finishedAt) {
    changedAttempts++;
    const score = attempt.answers.reduce((sum, a) => {
      const q = a.question;
      if (q.type !== 'test' || !Array.isArray(q.choices) || q.choices.length !== 4 || !q.correctChoice) {
        return sum + a.pointsEarned;
      }
      const given = String(a.givenAnswer || '').trim().toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(given)) return sum + a.pointsEarned;
      const shuffled = shuffleChoicesForAttempt(q.choices, q.correctChoice, attempt.id, q.id);
      const correct = String(shuffled.correctChoice || '').toUpperCase();
      return sum + (correct && given === correct ? q.points : 0);
    }, 0);
    console.log(`${APPLY ? 'FIX' : 'WOULD FIX'} attempt=${attempt.id} score ${attempt.score} -> ${score}`);
    if (APPLY) {
      await prisma.testAttempt.update({ where: { id: attempt.id }, data: { score } });
    }
  }
}

console.log(`\n${APPLY ? 'Applied' : 'Dry-run'}: scanned=${scanned} answers, regraded=${regraded}, finished attempts rescored=${changedAttempts}, skipped pre-${SHUFFLE_EPOCH.toISOString()} attempts=${skippedOld}`);
if (!APPLY) console.log('Дахин ажиллуулахад --apply нэмнэ үү.');
await prisma.$disconnect();
