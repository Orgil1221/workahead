import crypto from 'node:crypto';

export function otpDigest(email, code) {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('OTP_HASH_SECRET or JWT_SECRET must be configured');
  return crypto.createHmac('sha256', secret)
    .update(`${email.trim().toLowerCase()}:${String(code).trim()}`)
    .digest('hex');
}

export function otpMatches(email, code, digest) {
  if (!digest || !/^[a-f\d]{64}$/i.test(digest)) return false;
  const expected = Buffer.from(otpDigest(email, code), 'hex');
  const actual = Buffer.from(digest, 'hex');
  return crypto.timingSafeEqual(expected, actual);
}
