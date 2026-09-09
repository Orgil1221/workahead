import crypto from 'node:crypto';

// Business mail OTP — supports Resend API, SMTP (Nodemailer), or console fallback
// Env: RESEND_API_KEY, EMAIL_FROM (e.g. noreply@workahead.me), BUSINESS_MAIL, SMTP_HOST/PORT/USER/PASS

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000)); // 6 digits
}

export async function sendOtpEmail(to, otp) {
  const from = process.env.EMAIL_FROM || process.env.BUSINESS_MAIL || 'noreply@workahead.me';
  const subject = 'WorkAhead — Баталгаажуулах код';
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f7f3ea;border:1px solid #d8d0bd;border-radius:8px">
      <h2 style="font-family:Fraunces,serif;color:#211d17;margin:0 0 8px">WorkAhead — Баталгаажуулах код</h2>
      <p style="color:#5c5648">Таны 6 оронтой OTP код:</p>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px;background:#fffdf7;border:1px solid #d8d0bd;border-radius:8px;margin:16px 0;color:#211d17">${otp}</div>
      <p style="color:#97907e;font-size:13px">Код 10 минутын дотор хүчинтэй. Хэнд ч битгий хуваалцаарай.</p>
      <p style="color:#97907e;font-size:12px">WorkAhead • www.workahead.me • +976 66336691</p>
    </div>
  `;
  const text = `WorkAhead OTP: ${otp} (10 минут хүчинтэй)`;

  // 1. Resend API (business mail new API — prioritized)
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, html, text }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error('Resend failed:', res.status, body);
        throw new Error('Resend failed');
      }
      console.log(`OTP sent via Resend to ${to}`);
      return true;
    } catch (e) {
      console.error('Resend error:', e.message);
      // fall through to SMTP/console
    }
  }

  // 2. SMTP via Nodemailer if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({ from, to, subject, html, text });
      console.log(`OTP sent via SMTP to ${to}`);
      return true;
    } catch (e) {
      console.error('SMTP error:', e.message);
    }
  }

  // 3. Fallback — console + still succeed for dev/test (OTP visible in server logs)
  console.log(`[OTP Fallback] To: ${to} | Code: ${otp} | From: ${from} — set RESEND_API_KEY or SMTP_HOST to send real mail`);
  return true;
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER));
}
