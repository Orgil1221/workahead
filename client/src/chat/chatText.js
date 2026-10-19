export function moveMentions(previous, next, mentions) {
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start += 1;
  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (previousEnd > start && nextEnd > start && previous[previousEnd - 1] === next[nextEnd - 1]) { previousEnd -= 1; nextEnd -= 1; }
  const offset = nextEnd - previousEnd;
  return mentions.flatMap((mention) => {
    if (mention.end <= start) return [mention];
    if (mention.start >= previousEnd) return [{ ...mention, start: mention.start + offset, end: mention.end + offset }];
    return [];
  });
}

export function mentionQuery(value, start, end, mentions) {
  if (start !== end || mentions.some((mention) => start > mention.start && start <= mention.end)) return null;
  const match = value.slice(0, start).match(/(?:^|\s)@([^\n@]{0,80})$/u);
  if (!match) return null;
  const mentionStart = start - match[1].length - 1;
  if (mentions.some((mention) => mentionStart < mention.end && start > mention.start)) return null;
  return { start: mentionStart, end: start, text: match[1] };
}

export function messageDraft(value, mentions) {
  const offset = value.length - value.trimStart().length;
  const body = value.trim();
  return { body, mentions: mentions.map((mention) => ({ userId: mention.userId, start: mention.start - offset, end: mention.end - offset })).filter((mention) => mention.start >= 0 && mention.end <= body.length) };
}

export function sharedQuestion(body) {
  if (!body.startsWith('WAQ1:')) return null;
  try {
    const question = JSON.parse(body.slice(5));
    if (question?.type !== 'question' || typeof question.prompt !== 'string' || typeof question.examTitle !== 'string' || (question.topic != null && typeof question.topic !== 'string') || (question.year != null && typeof question.year !== 'number') || (question.choices != null && (!Array.isArray(question.choices) || !question.choices.every((choice) => typeof choice?.key === 'string' && typeof choice.text === 'string')))) return null;
    return question;
  } catch { return null; }
}

export function replySummary(message) {
  if (message.unavailable) return 'Эх мессеж боломжгүй байна';
  if (message.deleted) return 'Мессеж устгагдсан';
  const question = sharedQuestion(message.body);
  return question ? `Асуулт · ${question.examTitle}${question.topic ? ' · ' + question.topic : ''}` : message.body.slice(0, 200);
}
