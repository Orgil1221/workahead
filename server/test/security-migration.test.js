import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('security migration preserves existing accounts and OTP rows and enables hashed OTP storage', { timeout: 30000 }, async () => {
  const db = await PGlite.create();
  try {
    // The pre-hardening columns touched by this migration, with existing data.
    await db.exec(`
      CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT NOT NULL, "passwordHash" TEXT NOT NULL);
      CREATE TABLE "EmailOtp" (id TEXT PRIMARY KEY, email TEXT NOT NULL, otp TEXT NOT NULL);
      INSERT INTO "User" VALUES ('existing-user', 'migration@test.invalid', 'existing-password-hash');
      INSERT INTO "EmailOtp" VALUES ('existing-otp', 'migration@test.invalid', '123456');
    `);
    const sql = await readFile(new URL('../prisma/migrations/20261025000000_security_hardening/migration.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    const { rows: users } = await db.query('SELECT * FROM "User"');
    assert.equal(users.length, 1);
    assert.equal(users[0].passwordHash, 'existing-password-hash');
    assert.equal(users[0].isActive, true);
    assert.equal(users[0].verifyOtpAttempts, 0);
    const { rows: codes } = await db.query('SELECT * FROM "EmailOtp"');
    assert.equal(codes.length, 1);
    assert.equal(codes[0].otp, '123456');
    await db.exec(`UPDATE "EmailOtp" SET otp = NULL, "otpHash" = 'hash';`);
    const { rows: tables } = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'Admin%'`);
    assert.deepEqual(tables.map((row) => row.table_name).sort(), ['AdminAuditLog', 'AdminAuthChallenge', 'AdminLoginOtp', 'AdminTrustedDevice']);
  } finally { await db.close(); }
});
