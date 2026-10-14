const choiceSet = (values) => values.map((text, index) => ({ key: 'ABCD'[index], text: '$' + text + '$' }));
const questions = [
  { id: 'demo-integral', order: 1, type: 'open', topic: 'Интеграл', points: 5, prompt: 'Тодорхой интегралыг бодоорой. $$\\int_0^2 (3x^2+2x)\\,dx$$', answer: '12', correctChoice: 'B', choices: choiceSet(['8', '12', '16', '20']), modelSolution: '$$\\int_0^2(3x^2+2x)\\,dx = [x^3+x^2]_0^2 = 8+4 = 12.$$' },
  { id: 'demo-limit', order: 2, type: 'open', topic: 'Хязгаар', points: 5, prompt: 'Дараах хязгаарын утгыг олоорой. $$\\lim_{x\\to 0}\\frac{\\sin(3x)}{\\sin x}$$', answer: '3', correctChoice: 'C', choices: choiceSet(['0', '1', '3', '9']), modelSolution: '$$\\frac{\\sin(3x)}{\\sin x}=3\\cdot\\frac{\\sin(3x)}{3x}\\cdot\\frac{x}{\\sin x}\\to 3\\cdot1\\cdot1=3.$$' },
  { id: 'demo-derivative', order: 3, type: 'open', topic: 'Уламжлал', points: 5, prompt: '$f(x)=x^3-2x$ бол $f\'(2)$-ын утгыг олоорой.', answer: '10', correctChoice: 'A', choices: choiceSet(['10', '8', '12', '6']), modelSolution: '$f\'(x)=3x^2-2$ тул $f\'(2)=3\\cdot4-2=10$.' },
  { id: 'demo-probability', order: 4, type: 'test', topic: 'Магадлал', points: 5, prompt: 'Нэг шоог нэг удаа хаяхад тэгш тоо буух магадлал хэд вэ?', answer: '$\\frac{1}{2}$', correctChoice: 'D', choices: choiceSet(['\\frac{1}{6}', '\\frac{1}{3}', '\\frac{2}{3}', '\\frac{1}{2}']), modelSolution: 'Тэгш тоо нь 2, 4, 6. Нийт 6 боломжийн 3 нь таатай тул $P=\\frac{3}{6}=\\frac{1}{2}$.' },
];
const programs = [
  { id: 'demo-math', code: 'MATH101', name: 'Математик I' },
  { id: 'demo-math2', code: 'MATH102', name: 'Математик II' },
  { id: 'demo-physics', code: 'PHYS101', name: 'Ерөнхий физик' },
  { id: 'demo-economics', code: 'ECON101', name: 'Микро эдийн засаг' },
  { id: 'demo-english', code: 'ENGL101', name: 'Англи хэл' },
  { id: 'demo-programming', code: 'CS101', name: 'Програмчлалын үндэс' },
].map((program) => ({ ...program, _count: { exams: program.id === 'demo-math' ? 3 : 0 } }));
const university = { id: 'demo-university', name: 'Монгол Улсын Их Сургууль', shortName: 'МУИС', programs };
const exams = [
  { id: 'demo-exam', title: 'Математик I · Улирлын шалгалт', year: 2025, variant: 'A', isFree: true },
  { id: 'demo-exam2', title: 'Математик I · Явцын шалгалт', year: 2025, variant: 'B', isFree: false },
  { id: 'demo-exam3', title: 'Математик I · Улирлын шалгалт', year: 2024, variant: 'A', isFree: true },
].map((exam) => ({ ...exam, programId: 'demo-math', program: { ...programs[0], university: { name: university.name } }, durationMin: 30, _count: { questions: questions.length }, questions }));
const clone = (value) => JSON.parse(JSON.stringify(value));
const publicQuestion = (question) => ({ ...question, answer: null, modelSolution: null, correctChoice: null });

export function createStudyPreviewApi() {
  let state;
  try { state = JSON.parse(sessionStorage.getItem('wa_study_preview_v1')); } catch {}
  if (!state || !state.attempts || !Array.isArray(state.bookmarks)) state = { attempts: {}, bookmarks: [] };
  const persist = () => { try { sessionStorage.setItem('wa_study_preview_v1', JSON.stringify(state)); } catch {} };
  return async function request(path, { method = 'GET', body } = {}) {
    await new Promise((resolve) => setTimeout(resolve, 140));
    const parts = path.split('?')[0].split('/').filter(Boolean);
    if (path === '/catalog') return clone({ universities: [university] });
    if (parts[0] === 'programs') return clone({ exams: exams.filter((exam) => exam.programId === parts[1]) });
    if (parts[0] === 'exams' && parts[1] === 'solution') {
      const question = questions.find((item) => item.id === parts[2]);
      return clone({ answer: question.answer, modelSolution: question.modelSolution, correctChoice: question.correctChoice });
    }
    if (parts[0] === 'exams') {
      const exam = exams.find((item) => item.id === parts[1]);
      if (!exam) throw new Error('Жишээ шалгалт олдсонгүй');
      return clone({ exam: { ...exam, questions: questions.map((question) => ({ ...publicQuestion(question), bookmarked: state.bookmarks.includes(question.id) })) } });
    }
    if (path === '/attempts' && method === 'POST') {
      const exam = exams.find((item) => item.id === body.examId);
      const id = 'demo-attempt-' + Date.now();
      const attempt = { id, examId: exam.id, exam: { ...exam, questions: undefined }, mode: body.mode, format: body.mode === 'TEST' ? 'TEST' : 'OPEN', startedAt: new Date().toISOString(), answers: [], score: 0, totalPoints: 0, finishedAt: null };
      state.attempts[id] = attempt;
      persist();
      return clone({ attempt });
    }
    if (path === '/attempts/history/list') return clone({ attempts: Object.values(state.attempts).filter((attempt) => attempt.finishedAt).sort((first, second) => new Date(second.finishedAt) - new Date(first.finishedAt)) });
    if (path === '/attempts/practice/wrong') {
      const wrong = new Map();
      Object.values(state.attempts).filter((attempt) => attempt.finishedAt).forEach((attempt) => attempt.answers.filter((answer) => !answer.isCorrect).forEach((answer) => wrong.set(answer.questionId, { ...publicQuestion(answer.question), exam: { title: attempt.exam.title } })));
      return clone({ questions: [...wrong.values()] });
    }
    if (parts[0] === 'attempts') {
      const attempt = state.attempts[parts[1]];
      if (!attempt) throw new Error('Жишээ оролдлого олдсонгүй. Нүүрээс шалгалтаа дахин эхлүүлнэ үү.');
      if (parts[2] === 'answers') {
        if (attempt.finishedAt) throw new Error('Шалгалт дууссан');
        const question = questions.find((item) => item.id === body.questionId);
        const choiceQuestion = question.type === 'test' || attempt.mode === 'TEST';
        const isCorrect = body.givenAnswer.trim() === (choiceQuestion ? question.correctChoice : question.answer);
        const answer = { id: attempt.id + question.id, questionId: question.id, question, givenAnswer: body.givenAnswer, isCorrect, pointsEarned: isCorrect ? question.points : 0, gradedBy: 'AUTO' };
        attempt.answers = [...attempt.answers.filter((item) => item.questionId !== question.id), answer];
        persist();
        return clone({ answer });
      }
      if (parts[2] === 'ai-grade') return { enabled: false, graded: 0 };
      if (parts[2] === 'finish') {
        attempt.finishedAt = new Date().toISOString();
        attempt.totalPoints = questions.reduce((total, question) => total + question.points, 0);
        attempt.score = attempt.answers.reduce((total, answer) => total + answer.pointsEarned, 0);
        persist();
      }
      return clone({ attempt: { ...attempt, answers: attempt.answers.map((answer) => ({ ...answer, question: attempt.finishedAt ? answer.question : publicQuestion(answer.question) })) } });
    }
    if (parts[0] === 'bookmarks') {
      if (method === 'POST') state.bookmarks = [...new Set([...state.bookmarks, parts[1]])];
      if (method === 'DELETE') state.bookmarks = state.bookmarks.filter((id) => id !== parts[1]);
      persist();
      return { bookmarks: state.bookmarks.map((id) => ({ question: { id } })) };
    }
    if (path === '/flags') return { ok: true };
    throw new Error('Жишээ API зам олдсонгүй: ' + path);
  };
}
