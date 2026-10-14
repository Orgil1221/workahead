export const PERIODS = [
  { value: '7', label: '7 хоног' },
  { value: '30', label: '30 хоног' },
  { value: 'all', label: 'Бүгд' },
];

export function scorePercent(attempt) {
  const total = Number(attempt.totalPoints);
  const score = Number(attempt.score);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score / total * 100)));
}

export function dateLabel(value, options = {}) {
  return new Date(value).toLocaleDateString('mn-MN', { month: 'numeric', day: 'numeric', ...options });
}

function dayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function buildDashboardData(attempts, period, now = new Date()) {
  const finished = attempts
    .filter((attempt) => attempt.finishedAt && Number.isFinite(new Date(attempt.finishedAt).getTime()))
    .slice()
    .sort((first, second) => new Date(first.finishedAt) - new Date(second.finishedAt));
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  if (period !== 'all') cutoff.setDate(cutoff.getDate() - Number(period) + 1);
  const filtered = finished.filter((attempt) => new Date(attempt.finishedAt) <= now && (period === 'all' || new Date(attempt.finishedAt) >= cutoff));
  const scored = filtered.filter((attempt) => scorePercent(attempt) !== null);
  const percentages = scored.map(scorePercent);
  const average = percentages.length ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : null;
  const latest = percentages.at(-1) ?? null;
  const previous = percentages.at(-2) ?? null;
  const activity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6 + index);
    const count = finished.filter((attempt) => new Date(attempt.finishedAt) <= now && dayKey(attempt.finishedAt) === dayKey(date)).length;
    return { date, count, label: ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'][date.getDay()] };
  });
  return {
    filtered,
    scored,
    average,
    best: percentages.length ? Math.max(...percentages) : null,
    latest,
    change: latest !== null && previous !== null ? latest - previous : null,
    activeDays: new Set(filtered.map((attempt) => dayKey(attempt.finishedAt))).size,
    activity,
    chartAttempts: scored.slice(-20),
    recent: filtered.slice(-4).reverse(),
  };
}
