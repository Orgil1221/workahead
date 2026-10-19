// Deterministic shuffle per attempt — same seed = same order, so grading matches what student saw
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function seededShuffle(array, seed) {
  const arr = [...array];
  let m = arr.length;
  let s = seed % 233280;
  if (s <= 0) s = 1;
  const random = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  while (m) {
    const i = Math.floor(random() * m--);
    [arr[m], arr[i]] = [arr[i], arr[m]];
  }
  return arr;
}

export function shuffleChoicesForAttempt(choices, correctChoice, attemptId, questionId) {
  if (!Array.isArray(choices) || choices.length !== 4 || !correctChoice) return { choices, correctChoice };
  // Resolve correct option by original index so duplicate option texts can't pick the wrong letter
  const correctIndex = choices.findIndex((c) => String(c.key || '').toUpperCase() === String(correctChoice).toUpperCase());
  if (correctIndex < 0) return { choices, correctChoice };
  const seed = hashString(String(attemptId) + String(questionId));
  const order = seededShuffle(choices.map((_, i) => i), seed);
  const newChoices = order.map((from, i) => ({ key: String.fromCharCode(65 + i), text: choices[from].text }));
  const newCorrect = String.fromCharCode(65 + order.indexOf(correctIndex));
  return { choices: newChoices, correctChoice: newCorrect };
}
