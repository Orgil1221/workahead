export const IDLE_AFTER_MS = 120000;

export function createUsageClock({ now, serverTime, visible }) {
  const origin = now;
  let previous = now;
  let lastActivity = now;
  let foreground = visible;
  let intervals = [];
  function sample(timestamp) {
    const end = Math.min(timestamp, lastActivity + IDLE_AFTER_MS);
    if (foreground && timestamp - previous <= 5000 && end > previous) {
      const start = Math.floor(serverTime + previous - origin);
      const finish = Math.floor(serverTime + end - origin);
      const latest = intervals.at(-1);
      if (latest && latest.end === start && finish - latest.start <= 120000) latest.end = finish;
      else if (finish > start) intervals.push({ start, end: finish });
    }
    previous = timestamp;
  }
  return {
    sample,
    activity(timestamp) { sample(timestamp); lastActivity = timestamp; },
    visibility(visible, timestamp) {
      sample(timestamp);
      foreground = visible;
      if (visible) lastActivity = timestamp;
    },
    drain(timestamp) {
      sample(timestamp);
      const result = intervals;
      intervals = [];
      return result;
    },
    serverNow(timestamp) { return serverTime + timestamp - origin; },
  };
}
