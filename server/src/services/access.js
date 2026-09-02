import prisma from '../db.js';

// Exam is paid-gated if it belongs to at least one plan.
// Free preview: each course's designated free exam (isFree) is open to everyone.
// Access = isFree, or a PAID transaction by this user for any plan containing the exam.
export async function userHasExamAccess(userId, examId) {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { isFree: true } });
  if (!exam) return false;
  if (exam.isFree) return true;
  const gated = await prisma.planExam.findFirst({ where: { examId }, select: { planId: true } });
  if (!gated) {
    // Шалгалт ямар ч багцад ороогүй ч төлбөртэй гэж үзнэ — багцгүй хүн орохгүй
    if (!userId) return false;
    const now = new Date();
    const anyActive = await prisma.paymentTransaction.findFirst({
      where: { userId, status: 'PAID', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { id: true },
    });
    return Boolean(anyActive);
  }
  if (!userId) return false;
  const now = new Date();
  const owned = await prisma.paymentTransaction.findFirst({
    where: {
      userId,
      status: 'PAID',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
      plan: { exams: { some: { examId } } },
    },
    select: { id: true, expiresAt: true },
  });
  return Boolean(owned);
}

export async function getUserActivePlan(userId) {
  const now = new Date();
  return prisma.paymentTransaction.findFirst({
    where: { userId, status: 'PAID', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { expiresAt: 'desc' },
    include: { plan: true },
  });
}

export function paymentRequired(planTitle) {
  return Object.assign(new Error(planTitle ? `'${planTitle}' багц худалдаж авах шаардлагатай` : 'Төлбөр төлөх шаардлагатай'), {
    status: 403,
    code: 'PAYMENT_REQUIRED',
  });
}
