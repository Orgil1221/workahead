export function validateProductionSecurity(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const names = ['JWT_SECRET', 'CSRF_SECRET', 'OTP_HASH_SECRET'];
  for (const name of names) {
    const secret = env[name];
    if (!secret || secret.trim().length < 32 || /change[-_ ]?me|example|placeholder/i.test(secret)) {
      throw new Error(`${name} must be a fresh random secret of at least 32 characters in production`);
    }
  }
  if (new Set(names.map((name) => env[name])).size !== names.length) {
    throw new Error('JWT_SECRET, CSRF_SECRET and OTP_HASH_SECRET must be different');
  }
  const recipient = env.ADMIN_OTP_RECIPIENT?.trim();
  if (!recipient || recipient.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient)) {
    throw new Error('ADMIN_OTP_RECIPIENT must configure one private admin email address');
  }
  const origins = (env.CORS_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.length || origins.some((value) => {
    try { const url = new URL(value); return url.protocol !== 'https:' || url.origin !== value; }
    catch { return true; }
  })) throw new Error('CORS_ORIGIN must explicitly list HTTPS frontend origins');
}
