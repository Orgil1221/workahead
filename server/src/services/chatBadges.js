import prisma from '../db.js';

export const badgeColors = ['orange', 'violet', 'blue', 'green'];
export const badgeCatalog = [
  { id: 'starter', label: 'Эхний алхам', symbol: '✦', description: 'Эхний шалгалтаа дуусгах', count: 1 },
  { id: 'explorer', label: 'Эрэлч', symbol: '◇', description: '10 шалгалт дуусгах', count: 10 },
  { id: 'dedicated', label: 'Тууштай', symbol: '◆', description: '50 шалгалт дуусгах', count: 50 },
  { id: 'century', label: 'Зуун алхам', symbol: '✹', description: '100 шалгалт дуусгах', count: 100 },
  { id: 'high-score', label: 'Онцгой дүн', symbol: '★', description: 'Шалгалтад 90% ба түүнээс дээш авах', score: 90 },
  { id: 'week', label: '7 хоног', symbol: 'ϟ', description: '7 өдөр дараалан шалгалт дуусгах', streak: 7 },
  { id: 'month', label: '30 хоног', symbol: 'ϟ', description: '30 өдөр дараалан шалгалт дуусгах', streak: 30 },
  { id: 'hundred-days', label: '100 хоног', symbol: 'ϟ', description: '100 өдөр дараалан шалгалт дуусгах', streak: 100 },
];

let cachedMetrics;
let metricsPending;
let metricsAt = 0;

async function metrics() {
  if (cachedMetrics && Date.now() - metricsAt < 30000) return cachedMetrics;
  if (metricsPending) return metricsPending;
  metricsPending = prisma.$queryRaw`
    WITH eligible AS (
      SELECT attempt."userId", attempt."examId", attempt."finishedAt",
        (attempt."finishedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ulaanbaatar')::date AS day,
        attempt.score / attempt."totalPoints" * 100 AS percent
      FROM "TestAttempt" attempt JOIN "User" student ON student.id = attempt."userId"
      WHERE attempt."finishedAt" IS NOT NULL AND attempt."totalPoints" > 0
        AND attempt.mode IN ('TEST', 'TIMED') AND student.role = 'STUDENT'
        AND EXISTS (SELECT 1 FROM "AttemptAnswer" answer WHERE answer."attemptId" = attempt.id AND length(trim(coalesce(answer."givenAnswer", ''))) > 0)
    ), days AS (
      SELECT DISTINCT "userId", day FROM eligible
    ), islands AS (
      SELECT "userId", day, day - (row_number() OVER (PARTITION BY "userId" ORDER BY day))::int AS grp FROM days
    ), streaks AS (
      SELECT "userId", count(*) AS length FROM islands GROUP BY "userId", grp
    ), dailyExams AS (
      SELECT "userId", "examId", day, min("finishedAt") AS first, max(percent) AS percent FROM eligible GROUP BY "userId", "examId", day
    ), totals AS (
      SELECT "userId", count(DISTINCT ("examId", day))::int AS count, max(percent) AS best,
        max(first) AS latest FROM dailyExams GROUP BY "userId"
    ) SELECT totals.*, coalesce((SELECT max(length)::int FROM streaks WHERE streaks."userId" = totals."userId"), 0) AS streak,
      (row_number() OVER (ORDER BY count DESC, latest ASC, "userId" ASC))::int AS rank FROM totals
  `.then((rows) => {
    cachedMetrics = new Map(rows.map((row) => [row.userId, row]));
    metricsAt = Date.now();
    return cachedMetrics;
  }).finally(() => { metricsPending = null; });
  return metricsPending;
}

export async function chatPeople(ids) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const [users, totals] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: unique } }, select: {
      id: true, name: true, role: true, academicProgram: { select: { school: true } },
      program: { select: { school: true } }, chatProfile: true,
      payments: { where: { status: 'PAID', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true }, take: 1 },
    } }), metrics(),
  ]);
  return new Map(users.map((user) => {
    const stats = totals.get(user.id) || { count: 0, best: 0, streak: 0, rank: null };
    const earned = badgeCatalog.filter((badge) => (badge.count && stats.count >= badge.count) || (badge.score && stats.best >= badge.score) || (badge.streak && stats.streak >= badge.streak));
    const rank = stats.rank && stats.rank <= 10 ? { id: 'rank', label: `#${stats.rank}`, symbol: '♜', description: `Шалгалтын тоогоор ${stats.rank}-р байр` } : null;
    if (rank) earned.unshift(rank);
    const profile = user.chatProfile || {};
    const selected = earned.find((badge) => badge.id === profile.selectedBadge) || null;
    const badges = [];
    if (user.role === 'ADMIN') badges.push({ id: 'admin', label: 'ADMIN', symbol: '✓', color: 'admin' });
    const school = user.academicProgram?.school || user.program?.school;
    if (user.role !== 'ADMIN') badges.push({ id: 'school', label: school || 'Суралцагч', symbol: '◇', color: 'school' });
    if (user.payments.length) badges.push({ id: 'plan', label: 'Багц', symbol: '✧', color: 'plan' });
    if (selected) badges.push({ ...selected, color: profile.badgeColor || 'orange' });
    return [user.id, { id: user.id, name: user.name, role: user.role, school, premium: Boolean(user.payments.length), badges, timeoutUntil: profile.timeoutUntil && profile.timeoutUntil > new Date() ? profile.timeoutUntil : null,
      earned, stats: { count: stats.count, streak: stats.streak, best: Number(stats.best), rank: stats.rank },
      settings: { selectedBadge: selected?.id || null, badgeColor: profile.badgeColor || 'orange', allowInvites: profile.allowInvites ?? true, muted: profile.muted ?? false } }];
  }));
}

export function publicPerson(person) {
  if (!person) return { id: '', name: 'Устсан бүртгэл', badges: [] };
  const { id, name, role, school, premium, badges, timeoutUntil } = person;
  return { id, name, role, school, premium, badges, timeoutUntil };
}
