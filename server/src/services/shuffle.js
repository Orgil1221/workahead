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
  const correctText = choices.find((c) => c.key === correctChoice)?.text;
  if (!correctText) return { choices, correctChoice };
  const seed = hashString(String(attemptId) + String(questionId));
  const shuffled = seededShuffle(choices, seed);
  const newChoices = shuffled.map((c, i) => ({ key: String.fromCharCode(65 + i), text: c.text }));
  const newCorrect = newChoices.find((c) => c.text === correctText)?.key || correctChoice;
  return { choices: newChoices, correctChoice: newCorrect };
}
