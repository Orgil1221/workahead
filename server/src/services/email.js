import crypto from 'node:crypto';

// Business mail OTP — supports Resend API, SMTP (Nodemailer), or console fallback
// Env: RESEND_API_KEY, EMAIL_FROM (e.g. noreply@workahead.me), BUSINESS_MAIL, SMTP_HOST/PORT/USER/PASS

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000)); // 6 digits
}

const EMAIL_COPY = {
  register: {
    subject: 'WorkAhead — Бүртгэл баталгаажуулах код',
    title: 'Бүртгэл баталгаажуулах',
    intro: 'WorkAhead платформд бүртгүүлж байгаад баярлалаа. Бүртгэлээ баталгаажуулахын тулд доорх 6 оронтой кодыг оруулна уу.',
  },
  reset: {
    subject: 'WorkAhead — Нууц үг сэргээх код',
    title: 'Нууц үг сэргээх',
    intro: 'Таны бүртгэлд нууц үг сэргээх хүсэлт ирлээ. Шинэ нууц үг үүсгэхийн тулд доорх 6 оронтой кодыг оруулна уу. Хэрэв та энэ хүсэлтийг гаргаагүй бол энэ мэйлийг үл тооно уу.',
  },
  verify: {
    subject: 'WorkAhead — Баталгаажуулах код',
    title: 'Баталгаажуулах код',
    intro: 'Таны 6 оронтой баталгаажуулах код:',
  },
};

function buildOtpHtml({ otp, purpose }) {
  const copy = EMAIL_COPY[purpose] || EMAIL_COPY.verify;
  // Албан ёсны загвар: цэвэр цагаан суурь, бараан header тууз, тод OTP блок
  return `
  <div style="margin:0;padding:0;background-color:#eef0f4;font-family:'Segoe UI',Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px">
      <div style="background:#ffffff;border:1px solid #dfe3ea;border-radius:12px;overflow:hidden">
        <div style="background:#1a2a4a;padding:24px 32px;text-align:left">
          <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;margin:0">Work<span style="color:#7aa2ff">·</span>Ahead</div>
          <div style="color:#b9c4d8;font-size:13px;margin-top:4px">Шалгалтын бэлтгэлийн албан ёсны платформ</div>
        </div>
        <div style="padding:32px">
          <h2 style="color:#1a2a4a;font-size:20px;margin:0 0 12px">${copy.title}</h2>
          <p style="color:#3d4657;font-size:14px;line-height:1.7;margin:0 0 8px">Сайн байна уу,</p>
          <p style="color:#3d4657;font-size:14px;line-height:1.7;margin:0 0 20px">${copy.intro}</p>
          <div style="text-align:center;margin:24px 0">
            <div style="display:inline-block;font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:10px;text-indent:10px;color:#1a2a4a;background:#f2f5fb;border:1px dashed #7aa2ff;border-radius:10px;padding:16px 24px">${otp}</div>
          </div>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#fff8e6;border:1px solid #f0d48a;border-radius:8px">
            <tr><td style="padding:12px 16px;color:#6b5a1e;font-size:13px;line-height:1.6">
              <strong>Анхааруулга:</strong> Энэ код <strong>10 минутын</strong> дотор хүчинтэй. Кодыг хэнд ч дамжуулж болохгүй. WorkAhead-ийн ажилтан танаас кодыг хэзээ ч асуухгүй.
            </td></tr>
          </table>
          <p style="color:#6b7484;font-size:13px;line-height:1.6;margin:0">Хүндэтгэсэн,<br><strong style="color:#1a2a4a">WorkAhead баг</strong></p>
        </div>
        <div style="background:#f6f7f9;border-top:1px solid #e6e9ef;padding:16px 32px;text-align:center">
          <p style="color:#8a94a6;font-size:12px;margin:0 0 4px">www.workahead.me &nbsp;•&nbsp; +976 66336691</p>
          <p style="color:#aab2c0;font-size:11px;margin:0">Энэ мэйл автоматаар илгээгдсэн тул хариу бичих шаардлагагүй.</p>
        </div>
      </div>
    </div>
  </div>`;
}

export async function sendOtpEmail(to, otp, purpose = 'verify') {
  const from = process.env.EMAIL_FROM || process.env.BUSINESS_MAIL || 'noreply@workahead.me';
  const copy = EMAIL_COPY[purpose] || EMAIL_COPY.verify;
  const subject = copy.subject;
  const html = buildOtpHtml({ otp, purpose });
  const text = `WorkAhead — ${copy.title}: ${otp} (10 минут хүчинтэй). Хэнд ч битгий хуваалцаарай. www.workahead.me`;

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
