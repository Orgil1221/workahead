import { Prisma } from '@prisma/client';
import { buildUsageReport, usageBuckets, usageWindow, USAGE_RETENTION_DAYS } from './usageMetrics.js';

export async function recordUsage(database, userId, intervals, now = Date.now()) {
  const buckets = usageBuckets(intervals, now);
  if (!buckets.length) return;
  const values = buckets.map(({ minute, mask }) => Prisma.sql`(${userId}, ${new Date(minute)}, ${mask})`);
  await database.$transaction(async (transaction) => {
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO "UsageMinute" ("userId", "minuteAt", "secondsMask")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("userId", "minuteAt") DO UPDATE
      SET "secondsMask" = "UsageMinute"."secondsMask" | EXCLUDED."secondsMask"
    `);
    await transaction.siteSetting.upsert({
      where: { key: 'usageTrackingStartedAt' },
      create: { key: 'usageTrackingStartedAt', value: new Date(buckets[0].minute).toISOString() },
      update: {},
    });
  });
}

export async function readUsage(database, days, now = Date.now()) {
  const { start, end } = usageWindow(days, now);
  const [rows, marker] = await Promise.all([
    database.$queryRaw(Prisma.sql`
      WITH observed AS (
        SELECT "userId",
          to_char(("minuteAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day,
          EXTRACT(HOUR FROM ("minuteAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ulaanbaatar')::int AS hour,
          length(replace(("secondsMask"::bit(60))::text, '0', '')) AS seconds
        FROM "UsageMinute"
        WHERE "minuteAt" >= ${new Date(start)} AND "minuteAt" <= ${new Date(end)}
      )
      SELECT day, hour, COALESCE(SUM(seconds), 0)::bigint AS seconds,
        COUNT(DISTINCT "userId")::int AS users
      FROM observed
      GROUP BY GROUPING SETS ((day), (hour), ())
    `),
    database.siteSetting.findUnique({ where: { key: 'usageTrackingStartedAt' } }),
  ]);
  return buildUsageReport(rows, days, now, marker?.value || null);
}

export function pruneUsage(database, now = Date.now()) {
  return database.usageMinute.deleteMany({ where: { minuteAt: { lt: new Date(now - USAGE_RETENTION_DAYS * 86400000) } } });
}
