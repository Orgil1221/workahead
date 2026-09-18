import prisma from '../db.js';

/**
 * Expire stale PENDING transactions — prevents PENDING flood DoS on daily caps
 * Run every 5-10 minutes via setInterval or external cron
 */
export async function expireStalePending(ttlMinutes = Number(process.env.PENDING_TTL_MINUTES || 15)) {
  const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000);
  try {
    const result = await prisma.paymentTransaction.updateMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      data: { status: 'FAILED', provider: 'EXPIRED' },
    });
    if (result.count > 0) console.log(`[expirePending] expired ${result.count} stale PENDING (>${ttlMinutes}m)`);
    return result.count;
  } catch (e) {
    console.error('[expirePending] error:', e.message);
    return 0;
  }
}

// If run directly: node src/jobs/expirePending.js
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  expireStalePending().then((n) => {
    console.log(`Done: ${n} expired`);
    process.exit(0);
  });
}
