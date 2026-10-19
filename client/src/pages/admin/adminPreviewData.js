const samplePrograms = [
  { id: 'preview-math', universityId: 'preview-num', name: 'Математик 1Б', code: 'MATH101', school: '', _count: { exams: 2 } },
  { id: 'preview-physics', universityId: 'preview-num', name: 'Физик 1', code: 'PHYS101', school: '', _count: { exams: 1 } },
  { id: 'preview-major', universityId: 'preview-num', name: 'Программ хангамж', code: 'SE', school: 'МТЭС', _count: { exams: 0 } },
  { id: 'preview-finance', universityId: 'preview-num', name: 'Санхүү', code: 'FIN', school: 'БС', _count: { exams: 0 } },
];
const sampleExams = [
  { id: 'preview-exam-1', code: 'math1b-2024', title: 'Математик 1Б — Явцын шалгалт', year: 2024, variant: 'А хувилбар', isFree: true, programId: 'preview-math', program: samplePrograms[0], _count: { questions: 25, attempts: 136 } },
  { id: 'preview-exam-2', code: 'math1b-2023', title: 'Математик 1Б — Улирлын шалгалт', year: 2023, variant: 'Б хувилбар', isFree: false, programId: 'preview-math', program: samplePrograms[0], _count: { questions: 30, attempts: 94 } },
  { id: 'preview-exam-3', code: 'physics-2024', title: 'Физик 1 — Явцын шалгалт', year: 2024, variant: 'А хувилбар', isFree: false, programId: 'preview-physics', program: samplePrograms[1], _count: { questions: 20, attempts: 58 } },
];
const sampleQuestions = [
  { id: 'preview-question-1', examId: 'preview-exam-1', type: 'open', topic: 'Хязгаар', level: 'medium', year: 2024, source: 'Жишээ материал', prompt: 'Дараах хязгаарыг ол. $\\lim_{x\\to 0}\\frac{\\sin(3x)}{\\sin x}$', modelSolution: '$\\lim_{x\\to 0}3\\frac{\\sin(3x)}{3x}\\frac{x}{\\sin x}=3$', answer: '3', points: 4, needsReview: false, tags: ['Хязгаар'], choices: [], correctChoice: null, order: 1, exam: sampleExams[0], _count: { flags: 4 } },
  { id: 'preview-question-2', examId: 'preview-exam-1', type: 'test', topic: 'Интеграл', level: 'easy', year: 2024, source: 'Жишээ материал', prompt: 'Интегралыг бод. $\\int_0^2(3x^2+2x)\\,dx$', modelSolution: '$[x^3+x^2]_0^2=8+4=12$', answer: '12', points: 3, needsReview: false, tags: ['Интеграл'], choices: [{ key: 'A', text: '8' }, { key: 'B', text: '12' }, { key: 'C', text: '16' }, { key: 'D', text: '20' }], correctChoice: 'B', order: 2, exam: sampleExams[0], _count: { flags: 2 } },
  { id: 'preview-question-3', examId: 'preview-exam-2', type: 'open', topic: 'Уламжлал', level: 'easy', year: 2023, source: 'Жишээ материал', prompt: '$f(x)=x^3-2x$ функцийн уламжлалыг ол.', modelSolution: '$f\\prime(x)=3x^2-2$', answer: '3x^2-2', points: 3, needsReview: true, tags: ['Уламжлал'], choices: [], correctChoice: null, order: 1, exam: sampleExams[1], _count: { flags: 1 } },
];
const samplePlans = [
  { id: 'preview-plan-1', code: 'MATH1B', title: 'Математик 1Б', priceMnt: 14900, durationDays: 30, active: true, _count: { exams: 12, transactions: 58 } },
  { id: 'preview-plan-2', code: 'PHYSICS1', title: 'Физик 1', priceMnt: 12900, durationDays: 30, active: true, _count: { exams: 8, transactions: 29 } },
  { id: 'preview-plan-3', code: 'ALL', title: 'Бүх хичээл', priceMnt: 24900, durationDays: 30, active: true, _count: { exams: 20, transactions: 42 } },
];
const sampleMajors = [
  { id: 'preview-academic-1', university: 'МУИС', school: 'МТЭС', name: 'Программ хангамж', code: 'SE', order: 1 },
  { id: 'preview-academic-2', university: 'МУИС', school: 'МТЭС', name: 'Мэдээллийн систем', code: 'IS', order: 2 },
  { id: 'preview-academic-3', university: 'МУИС', school: 'БС', name: 'Санхүү', code: 'FIN', order: 3 },
];
const sampleUsers = [
  { id: 'preview-admin', name: 'Админ', email: 'admin@example.test', role: 'ADMIN', academicProgram: null, subscription: null, _count: { attempts: 0, flags: 0 } },
  { id: 'preview-user-1', name: 'Б. Тэмүүлэн', email: 'temuulen@example.test', role: 'STUDENT', academicProgram: sampleMajors[0], subscription: { title: 'Математик 1Б', isGift: false, expiresAt: new Date(Date.now() + 20 * 86400000).toISOString() }, _count: { attempts: 18, flags: 2 } },
  { id: 'preview-user-2', name: 'Д. Номин', email: 'nomin@example.test', role: 'STUDENT', academicProgram: sampleMajors[2], subscription: { title: 'Бүх хичээл', isGift: true, expiresAt: new Date(Date.now() + 12 * 86400000).toISOString() }, _count: { attempts: 12, flags: 1 } },
  { id: 'preview-user-3', name: 'Э. Анужин', email: 'anujin@example.test', role: 'STUDENT', academicProgram: sampleMajors[1], subscription: null, _count: { attempts: 4, flags: 0 } },
];
const sampleFlags = [
  { id: 'preview-flag-1', status: 'NEW', reason: 'Бодолтын алхмыг илүү дэлгэрэнгүй тайлбарлаж өгнө үү.', createdAt: '2026-10-15T06:30:00Z', user: sampleUsers[1], question: sampleQuestions[0] },
  { id: 'preview-flag-2', status: 'NEW', reason: 'Хариулттай холбоотой тайлбар хүсэж байна.', createdAt: '2026-10-14T08:00:00Z', user: sampleUsers[2], question: sampleQuestions[1] },
  { id: 'preview-flag-3', status: 'RESOLVED', reason: 'Томьёоны тэмдэглэгээг шалгана уу.', createdAt: '2026-10-13T09:00:00Z', user: sampleUsers[1], question: sampleQuestions[2] },
];
export function createAdminPreviewApi(scenario = 'populated') {
  let landingTheme = 'snow';
  let plans = structuredClone(samplePlans);
  const empty = scenario === 'empty';
  const list = (items) => empty ? [] : items;
  return async (path, options = {}) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    const url = new URL(path, 'https://admin-preview.invalid');
    const route = url.pathname;
    const method = options.method || 'GET';
    const body = options.body || {};
    let result;
    if (method !== 'GET') {
      if (route === '/admin/settings/landing-theme' && method === 'PUT') {
        landingTheme = body.landingTheme;
        return { landingTheme };
      }
      if (route.startsWith('/admin/plans/') && method === 'PUT') {
        const id = route.split('/').pop();
        plans = plans.map((plan) => plan.id === id ? { ...plan, ...body } : plan);
        return { plan: structuredClone(plans.find((plan) => plan.id === id)) };
      }
      throw new Error('Жишээ орчинд энэ үйлдэл хаалттай. Бодит мэдээлэл өөрчлөгдөөгүй.');
    }
    if (route === '/admin/usage') {
      if (scenario === 'error') throw new Error('Хэрэглээний хугацааг ачаалсангүй.');
      return sampleUsage(Number(url.searchParams.get('days') || 7), empty);
    }
    if (route === '/admin/stats') {
      if (scenario === 'error') throw new Error('Туршилтын алдаа: мэдээлэл ачаалсангүй. Өгөгдлийн төлөвийг сольж дахин үзнэ үү.');
      result = {
        totals: empty ? { users: 0, attempts: 0, questions: 0, newFlags: 0, paidUsers: 0, giftUsers: 0, activePaid: 0, activeGift: 0 } : { users: 1284, attempts: 4638, questions: 856, newFlags: 7, paidUsers: 423, giftUsers: 84, activePaid: 308, activeGift: 42 },
        mostFlagged: list(sampleQuestions),
      };
    } else if (route === '/admin/settings/landing-theme') result = { landingTheme };
    else if (route === '/admin/plans') result = { plans: list(plans) };
    else if (route === '/admin/catalog/universities') result = { universities: list([{ id: 'preview-num', name: 'Монгол Улсын Их Сургууль', shortName: 'МУИС', programs: samplePrograms }]) };
    else if (route === '/admin/catalog/exams') result = { exams: list(sampleExams).filter((exam) => !url.searchParams.get('programId') || exam.programId === url.searchParams.get('programId')) };
    else if (route === '/admin/catalog/questions') {
      const questions = list(sampleQuestions).filter((question) => {
        for (const field of ['examId', 'type', 'level', 'year']) if (url.searchParams.get(field) && String(question[field]) !== url.searchParams.get(field)) return false;
        if (url.searchParams.get('topic') && !question.topic.includes(url.searchParams.get('topic'))) return false;
        if (url.searchParams.get('tag') && !question.tags.includes(url.searchParams.get('tag'))) return false;
        return !url.searchParams.get('q') || question.prompt.toLowerCase().includes(url.searchParams.get('q').toLowerCase());
      });
      result = { total: questions.length, page: 1, pageSize: 25, questions };
    } else if (route.startsWith('/admin/catalog/questions/')) {
      const question = sampleQuestions.find((entry) => entry.id === route.split('/').pop());
      if (!question) throw new Error('Жишээ асуулт олдсонгүй.');
      result = { question };
    } else if (route === '/flags/admin') result = { flags: list(sampleFlags).filter((flag) => url.searchParams.get('status') === 'ALL' || flag.status === url.searchParams.get('status')) };
    else if (route === '/admin/users') result = { users: list(sampleUsers) };
    else if (route === '/admin/academic-programs' || route === '/academic-programs') result = { programs: list(sampleMajors) };
    else if (route === '/notifications') result = { notifications: list([{ id: 'preview-notification', title: 'Шинэ шалгалтын материал нэмэгдлээ', body: 'Математик 1Б хичээлийн явцын шалгалтын жишиг бодлогуудыг нэмж орууллаа. Бэлтгэлдээ амжилт хүсье!', program: samplePrograms[0], createdBy: { name: 'Админ' }, createdAt: '2026-10-15T04:00:00Z' }]) };
    else if (route === '/admin/import/template') result = { exam_id: 'preview-only-math', title: 'Жишээ шалгалт', year: 2026, questions: [{ type: 'open', prompt: '$2+2=?$', answer: '4', model_solution: '$2+2=4$', points: 1, tags: ['Алгебр'] }] };
    else throw new Error('Жишээ өгөгдөл байхгүй: ' + route);
    return structuredClone(result);
  };
}

function sampleUsage(days, empty) {
  const now = Date.now();
  const offset = 8 * 3600000;
  const today = new Date(now + offset).toISOString().slice(0, 10);
  const midnight = Date.parse(today + 'T00:00:00+08:00');
  const start = midnight - (days - 1) * 86400000;
  const daily = Array.from({ length: days }, (_, index) => {
    const timestamp = start + index * 86400000;
    const users = [38, 52, 47, 64, 75, 43, 31][index % 7];
    return { date: new Date(timestamp + offset).toISOString().slice(0, 10), seconds: empty ? null : users * [900, 1080, 1260, 1500, 1320, 1140, 960][index % 7], users: empty ? null : users, partial: index === days - 1 };
  });
  const totalSeconds = daily.reduce((sum, day) => sum + (day.seconds || 0), 0);
  const currentHour = new Date(now + offset).getUTCHours();
  const weights = [2, 1, 1, 1, 1, 2, 4, 6, 9, 11, 13, 12, 10, 11, 13, 15, 14, 12, 18, 23, 28, 24, 14, 7].map((weight, hour) => days === 1 && hour > currentHour ? 0 : weight);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const hourly = weights.map((weight, hour) => ({ hour, seconds: empty || (days === 1 && hour > currentHour) ? null : Math.floor(totalSeconds * weight / weightTotal), users: empty || (days === 1 && hour > currentHour) ? null : weight ? Math.max(1, Math.round(31 * weight / 28)) : 0 }));
  const observed = hourly.filter((hour) => hour.seconds !== null);
  const peak = observed.length ? observed.reduce((best, hour) => hour.seconds > best.seconds ? hour : best) : null;
  if (peak) peak.seconds += totalSeconds - observed.reduce((sum, hour) => sum + hour.seconds, 0);
  const quiet = observed.length ? observed.reduce((best, hour) => hour.seconds < best.seconds ? hour : best) : null;
  return {
    timezone: 'Asia/Ulaanbaatar', days, generatedAt: new Date(now).toISOString(),
    trackingSince: empty ? null : new Date(midnight - 30 * 86400000).toISOString(),
    totalSeconds, activeUsers: empty ? 0 : days === 1 ? daily[0].users : days === 7 ? 156 : 412,
    averagePerStudentDaySeconds: empty ? 0 : Math.round(totalSeconds / daily.reduce((sum, day) => sum + day.users, 0)),
    peakHour: peak?.hour ?? null, quietHour: quiet?.hour ?? null, daily, hourly,
  };
}
