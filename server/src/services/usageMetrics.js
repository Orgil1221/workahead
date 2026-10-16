export const USAGE_TIMEZONE = 'Asia/Ulaanbaatar';
export const USAGE_RETENTION_DAYS = 35;
const DAY_MS = 86400000;
const UB_OFFSET_MS = 8 * 3600000;

export function usageDay(timestamp) {
  return new Date(Number(timestamp) + UB_OFFSET_MS).toISOString().slice(0, 10);
}

export function usageWindow(days, now = Date.now()) {
  if (![1, 7, 30].includes(days)) throw Object.assign(new Error('Хугацаа 1, 7 эсвэл 30 хоног байна.'), { status: 400 });
  const today = usageDay(now);
  const todayStart = Date.parse(today + 'T00:00:00+08:00');
  return { start: todayStart - (days - 1) * DAY_MS, end: now, today };
}

export function usageBuckets(intervals, now = Date.now()) {
  if (!Array.isArray(intervals) || !intervals.length || intervals.length > 20) {
    throw Object.assign(new Error('Хугацааны интервал буруу.'), { status: 400 });
  }
  const buckets = new Map();
  for (const interval of intervals) {
    const { start, end } = interval || {};
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= end ||
        end - start > 120000 || start < now - 300000 || end > now + 5000) {
      throw Object.assign(new Error('Хугацааны интервал зөвшөөрөгдсөн хязгаараас хэтэрсэн.'), { status: 400 });
    }
    for (let second = Math.floor(start / 1000); second < Math.floor(Math.min(end, now) / 1000); second++) {
      const minute = Math.floor(second / 60) * 60000;
      buckets.set(minute, (buckets.get(minute) || 0n) | (1n << BigInt(second % 60)));
    }
  }
  return [...buckets].sort(([first], [second]) => first - second).map(([minute, mask]) => ({ minute, mask }));
}

export function buildUsageReport(rows, days, now, trackingSince) {
  const window = usageWindow(days, now);
  const coverageStart = trackingSince ? Math.max(Date.parse(trackingSince), now - USAGE_RETENTION_DAYS * DAY_MS) : null;
  const dayRows = new Map(rows.filter((row) => row.day != null).map((row) => [row.day, row]));
  const hourRows = new Map(rows.filter((row) => row.hour != null).map((row) => [Number(row.hour), row]));
  const total = rows.find((row) => row.day == null && row.hour == null);
  const daily = Array.from({ length: days }, (_, index) => {
    const start = window.start + index * DAY_MS;
    const date = usageDay(start);
    const covered = coverageStart !== null && start + DAY_MS > coverageStart && start < now;
    const row = dayRows.get(date);
    return { date, seconds: covered ? Number(row?.seconds || 0) : null, users: covered ? Number(row?.users || 0) : null, partial: covered && (start < coverageStart || start + DAY_MS > now) };
  });
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const covered = coverageStart !== null && daily.some((day, index) => {
      const start = window.start + index * DAY_MS + hour * 3600000;
      return day.seconds !== null && start < now && start + 3600000 > coverageStart;
    });
    const row = hourRows.get(hour);
    return { hour, seconds: covered ? Number(row?.seconds || 0) : null, users: covered ? Number(row?.users || 0) : null };
  });
  const seconds = Number(total?.seconds || 0);
  const userDays = daily.reduce((sum, day) => sum + (day.users || 0), 0);
  const observedHours = hourly.filter((hour) => hour.seconds !== null);
  const peakHour = seconds ? observedHours.reduce((peak, hour) => hour.seconds > peak.seconds ? hour : peak).hour : null;
  const quietHour = seconds ? observedHours.reduce((quiet, hour) => hour.seconds < quiet.seconds ? hour : quiet).hour : null;
  return {
    timezone: USAGE_TIMEZONE, days, generatedAt: new Date(now).toISOString(), trackingSince,
    totalSeconds: seconds, activeUsers: Number(total?.users || 0),
    averagePerStudentDaySeconds: userDays ? Math.round(seconds / userDays) : 0,
    peakHour, quietHour, daily, hourly,
  };
}
