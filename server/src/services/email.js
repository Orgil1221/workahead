import crypto from 'node:crypto';

// Business mail OTP — failover chain: Resend → Brevo → SMTP (Nodemailer) → console.
// Env: RESEND_API_KEY, BREVO_API_KEY, EMAIL_FROM (e.g. noreply@workahead.me), BUSINESS_MAIL,
//      SMTP_HOST/PORT/USER/PASS, EMAIL_PROVIDER_ORDER (default "resend,brevo,smtp"),
//      EMAIL_QUOTA_COOLDOWN_MIN / EMAIL_QUOTA_COOLDOWN_MAX_MIN / EMAIL_FAIL_COOLDOWN_SEC.
// A provider that fails (quota, rate limit, auth, network) is skipped for a cooldown window
// instead of being retried on every OTP; quota cooldowns double per consecutive failure.

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000)); // 6 digits
}

const EMAIL_COPY = {
  'admin-login': {
    subject: 'WorkAhead — Админы нэвтрэх код',
    title: 'Админы нэвтрэлтийг баталгаажуулах',
    intro: 'WorkAhead админ эрхээр нэвтрэх хүсэлт ирлээ. Нэвтрэлтийг баталгаажуулахын тулд доорх кодыг оруулна уу. Хэрэв та хүсэлт гаргаагүй бол нууц үгээ солино уу.',
    validity: '10 минут',
  },
  register: {
    subject: 'WorkAhead — Бүртгэл баталгаажуулах код',
    title: 'Бүртгэл баталгаажуулах',
    intro: 'WorkAhead платформд бүртгүүлж байгаад баярлалаа. Бүртгэлээ баталгаажуулахын тулд доорх 6 оронтой кодыг оруулна уу.',
    validity: '10 минут',
  },
  reset: {
    subject: 'WorkAhead — Нууц үг сэргээх код',
    title: 'Нууц үг сэргээх',
    intro: 'Таны бүртгэлд нууц үг сэргээх хүсэлт ирлээ. Шинэ нууц үг үүсгэхийн тулд доорх 6 оронтой кодыг оруулна уу. Хэрэв та энэ хүсэлтийг гаргаагүй бол энэ мэйлийг үл тооно уу.',
    validity: '10 минут',
  },
  verify: {
    subject: 'WorkAhead — Баталгаажуулах код',
    title: 'Баталгаажуулах код',
    intro: 'Таны 6 оронтой баталгаажуулах код:',
    validity: '10 минут',
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
              <strong>Анхааруулга:</strong> Энэ код <strong>${copy.validity}</strong> хүчинтэй. Кодыг хэнд ч дамжуулж болохгүй. WorkAhead-ийн ажилтан танаас кодыг хэзээ ч асуухгүй.
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

function envNum(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseFrom(from) {
  const m = /^(.*)<([^>]+)>\s*$/.exec(from.trim());
  if (m) return { name: m[1].trim().replace(/^"|"$/g, '') || 'WorkAhead', email: m[2].trim() };
  return { name: 'WorkAhead', email: from.trim() };
}

async function httpError(res) {
  const detail = (await res.text()).slice(0, 300);
  const e = new Error(`HTTP ${res.status}`);
  e.status = res.status;
  e.detail = detail;
  return e;
}

function failureClass(e) {
  const detail = String(e?.detail || e?.message || '');
  if (e?.status === 402 || /quota|max_quota|daily limit|sending limit/i.test(detail)) return 'quota';
  if (e?.status === 429 || /rate limit|too many requests|requests per second/i.test(detail)) return 'rate';
  if (e?.status === 401 || e?.status === 403 || e?.code === 'EAUTH') return 'auth';
  return 'other';
}

function envMinutes(name, fallback) {
  return envNum(name, fallback) * 60_000;
}

function cooldownMs(kind, consecutiveFails) {
  if (kind !== 'quota') return envNum('EMAIL_FAIL_COOLDOWN_SEC', 90) * 1000;
  const base = envMinutes('EMAIL_QUOTA_COOLDOWN_MIN', 30);
  const max = envMinutes('EMAIL_QUOTA_COOLDOWN_MAX_MIN', 360);
  return Math.min(base * 2 ** Math.max(0, consecutiveFails - 1), Math.max(base, max));
}

const providers = {
  resend: {
    configured: () => Boolean(process.env.RESEND_API_KEY),
    send: async (msg) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: msg.from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
      });
      if (!res.ok) throw await httpError(res);
    },
  },
  brevo: {
    configured: () => Boolean(process.env.BREVO_API_KEY),
    send: async (msg) => {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: parseFrom(msg.from),
          to: [{ email: msg.to }],
          subject: msg.subject,
          htmlContent: msg.html,
          textContent: msg.text,
        }),
      });
      if (!res.ok) throw await httpError(res);
    },
  },
  smtp: {
    configured: () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
    send: async (msg) => {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({ from: msg.from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
    },
  },
};

const health = new Map(); // provider → { disabledUntil: ms epoch, fails: n }

function providerOrder() {
  const raw = process.env.EMAIL_PROVIDER_ORDER || 'resend,brevo,smtp';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter((s) => providers[s]);
}

export async function sendOtpEmail(to, otp, purpose = 'verify') {
  const from = process.env.EMAIL_FROM || process.env.BUSINESS_MAIL || 'noreply@workahead.me';
  const copy = EMAIL_COPY[purpose] || EMAIL_COPY.verify;
  const msg = { from, to, subject: copy.subject, html: buildOtpHtml({ otp, purpose }), text: `WorkAhead — ${copy.title}: ${otp} (${copy.validity} хүчинтэй). Хэнд ч битгий хуваалцаарай. www.workahead.me` };

  for (const name of providerOrder()) {
    if (!providers[name].configured()) continue;
    const state = health.get(name) || { disabledUntil: 0, fails: 0 };
    if (Date.now() < state.disabledUntil) continue; // known-down: skip without waiting on its latency
    try {
      await providers[name].send(msg);
      health.set(name, { disabledUntil: 0, fails: 0 });
      console.log(`OTP sent via ${name} to ${to}`);
      return true;
    } catch (e) {
      const kind = failureClass(e);
      const fails = state.fails + 1;
      const wait = cooldownMs(kind, fails);
      health.set(name, { disabledUntil: Date.now() + wait, fails });
      console.error(`Email ${name} ${kind} failure — skipping ${Math.round(wait / 60_000)}m (fails=${fails}):`, e?.detail || e.message);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('OTP email delivery is unavailable'), { status: 503 });
  }
  console.log(`[OTP Fallback] Email provider unavailable; OTP not logged for ${to}.`);
  return false;
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || process.env.BREVO_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER));
}
