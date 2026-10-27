import test from 'node:test';
import assert from 'node:assert/strict';
import { otpDigest, otpMatches } from '../src/services/otp.js';
import { buildChoicesFromImport, parseCsv } from '../src/services/importService.js';
import { validateProductionSecurity } from '../src/config/security.js';
import crypto from 'node:crypto';

process.env.OTP_HASH_SECRET = 'test-only-secret-that-is-long-enough';

test('production rejects missing, example or reused secrets and non-HTTPS CORS origins', () => {
  const env = {
    NODE_ENV: 'production', CORS_ORIGIN: 'https://workahead.me,https://www.workahead.me',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    CSRF_SECRET: crypto.randomBytes(32).toString('hex'),
    OTP_HASH_SECRET: crypto.randomBytes(32).toString('hex'),
    ADMIN_OTP_RECIPIENT: 'private-security-mailbox@example.test',
  };
  assert.doesNotThrow(() => validateProductionSecurity(env));
  for (const name of ['JWT_SECRET', 'CSRF_SECRET', 'OTP_HASH_SECRET']) {
    assert.throws(() => validateProductionSecurity({ ...env, [name]: '' }), new RegExp(name));
    assert.throws(() => validateProductionSecurity({ ...env, [name]: 'change-me-to-a-long-random-secret-at-least-32-chars' }), new RegExp(name));
  }
  assert.throws(() => validateProductionSecurity({ ...env, CSRF_SECRET: env.JWT_SECRET }), /different/);
  for (const ADMIN_OTP_RECIPIENT of ['', 'not-an-email', 'one@example.test,two@example.test', 'one@example.test\r\nBcc: two@example.test']) {
    assert.throws(() => validateProductionSecurity({ ...env, ADMIN_OTP_RECIPIENT }), /ADMIN_OTP_RECIPIENT/);
  }
  for (const CORS_ORIGIN of ['', '*', 'http://workahead.me', 'https://workahead.me/path']) {
    assert.throws(() => validateProductionSecurity({ ...env, CORS_ORIGIN }), /CORS_ORIGIN/);
  }
});

test('OTP storage is a keyed digest and compares without accepting changed values', () => {
  const digest = otpDigest('Student@Example.mn', '012345');
  assert.match(digest, /^[a-f\d]{64}$/);
  assert.equal(digest.includes('012345'), false);
  assert.equal(otpMatches('student@example.mn', '012345', digest), true);
  assert.equal(otpMatches('student@example.mn', '012346', digest), false);
  assert.equal(otpMatches('student@example.mn', '012345', 'bad'), false);
});

test('import rejects incomplete multiple-choice answers before persistence', () => {
  assert.throws(() => buildChoicesFromImport({
    type: 'test', prompt: 'Pick one', choiceA: 'One', choiceB: '', correct_choice: 'A',
  }), /2–4 ялгаатай сонголт/);
  assert.deepEqual(buildChoicesFromImport({
    prompt: 'Pick one', choices: [{ key: 'A', text: 'One' }, { key: 'B', text: 'Two' }], correct_choice: 'B',
  }), {
    choices: [{ key: 'A', text: 'One' }, { key: 'B', text: 'Two' }],
    correctChoice: 'B',
  });
});

test('CSV parser preserves quoted commas and line breaks', () => {
  assert.deepEqual(parseCsv('prompt,answer\n"x, y\ncontinued",42'), [
    ['prompt', 'answer'], ['x, y\ncontinued', '42'],
  ]);
});
