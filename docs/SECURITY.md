# WorkAhead security notes

## Implemented in the application

- Admin login requires a password and a single-use, **10-minute** email code sent only to `L.monhorgil2007@gmail.com`. A successful verification remembers that browser profile for a fixed **24 hours**, without extending the window on subsequent logins. Another browser needs its own code. Five incorrect entries invalidate a challenge; sending is limited in the database to one per minute and five per 15 minutes per account. Expired codes can be replaced without waiting 24 hours.
- Challenges and remembered browsers use random 256-bit HttpOnly, SameSite=Strict cookies, with Secure and the host-only `__Host-` prefix in production. Only token hashes and keyed OTP digests reach the database. A challenge row lock prevents OTP replay; account row locks serialize send limits and credential revocation.
- Admin sessions and JWT expiry cannot exceed the remembered browser's expiry. Every admin request checks the device record, current role, account activity and credentials. Password change/reset, role changes and deactivation revoke trust, pending challenges and sessions. Legacy account-wide MFA timestamps and old admin JWTs do not bypass the new flow.
- Production refuses to start with missing, reused or example `OTP_HASH_SECRET`, `JWT_SECRET`, `CSRF_SECRET` values, or without explicit HTTPS `CORS_ORIGIN` entries.
- Browser sessions use an HttpOnly, Secure production cookie. Client code no longer stores or returns the JWT in local storage or JSON.
- All state-changing browser requests, including login, logout and admin seed, require CSRF proof bound to the session or an anonymous browser nonce. Only the HMAC-verified payment webhook is exempt. The client refreshes its CSRF proof after a session change.
- Login attempts are limited by source IP and a hash of the normalized account email. Redis is needed to share rate limits across multiple server instances.
- Admin changes and reads of the user/audit listings are written to `AdminAuditLog`; `/api/admin/audit` returns a paginated view. The log excludes request bodies and raw IP addresses.
- Admin account removal deactivates the account and revokes its sessions. User records and exam history remain in the database; an admin can reactivate the account.
- Import validates questions before writing and replaces exam questions in a database transaction. Seed imports also use a transaction.
- Uploads have strict file, field, and part limits. The API image has no data-loss-accepting schema command and fails startup if a schema change would delete data.
- API errors do not expose internal 5xx messages. Frontend security headers and a Content Security Policy are configured in `client/vercel.json`; they take effect on deployment.
- The browser retries only safe reads automatically, avoiding repeated payment or other mutation requests after an ambiguous timeout.

## Verification and rollout

Local verification on 2026-10-25 (Node 24.13.0, Windows): **26/26 tests passed** after the Zod update, including the shipped client API's login → CSRF refresh → profile update → logout flow against the real local routes. Prisma generation/validation and the Vite production build passed; Vite still reports a non-blocking large bundle warning. Both full dependency audits reported zero known vulnerabilities. GitHub CI runs on main, master, security branches and pull requests; check the exact release commit's workflow result before promotion.

**Pre-release observation (2026-10-25):** read-only checks returned HTTP 200 for the public site and API health endpoint; the public frontend did not yet return the newly configured CSP/nosniff/frame headers. Vercel CLI project access was confirmed. Render/Neon secrets, Redis, backup/PITR, proxy IP attribution and real mailbox delivery were not verified at this point because those provider connections were unavailable. These are release prerequisites/operational checks, not claims established by local tests. Test email was captured locally; no real OTP messages were sent by the suite.

Run `npm test` in `server`, `npx prisma validate` with a local dummy `DATABASE_URL`, and `npm run build` in `client`. The auth integration suite starts real Express routes and Prisma against an isolated PGlite PostgreSQL engine by default. It never loads `.env`, sends real email or connects to production. HTTP tests cover browser binding, OTP expiry/attempt limits/replay, session revocation, password recovery, student permissions, CSRF, cookie attributes, delivery failure and rate limiting. A migration test checks preservation of existing rows. PGlite serializes connections; CI is configured to run the same HTTP tests with PostgreSQL 16 and a five-connection pool to exercise concurrent transactions.

For a dedicated local PostgreSQL test instance, set `TEST_DATABASE_URL` to a loopback database named `workahead_security_test` before `npm test`. The test runner rejects other hosts/database names, applies the schema and removes its test fixtures afterward. Do not use a database containing real users.

The additive SQL at `server/prisma/migrations/20261025000000_security_hardening/migration.sql` describes the upgrade from the pre-hardening schema. Render currently runs `prisma db push --skip-generate` before startup. Do not run the SQL again against an already upgraded schema; do not switch to `migrate deploy` until the older database has been correctly baselined. Existing legacy OTP/MFA columns remain for compatibility, but grant no admin trust. Back up and verify schema changes before a production rollout. Deploy the matching API and client changes together; old clients must reload for the updated CSRF logout flow. Existing admin sessions must reauthenticate after this rollout.

## Required production operations

1. Set unique, randomly generated production values for `JWT_SECRET`, `CSRF_SECRET`, and `OTP_HASH_SECRET`; never reuse the examples or commit live values.
2. Configure a working transactional email provider. Without it, admin login fails closed after password verification.
3. Remove any previously created demo accounts and rotate any admin passwords that may have been used outside production.
4. Configure Redis for rate limits if deploying more than one API process/instance.
5. Verify Neon backups/PITR, retention, and restore access in the provider dashboard; perform a restore drill before relying on it. App code cannot prove provider backup state.
6. Restrict production database credentials to the application and keep them separate from personal/dev credentials.
7. Review `/api/admin/audit` after admin changes and define a retention policy for the audit table.
8. Confirm Vercel response headers and CSP against the live site after deployment. Provider dashboard settings and current secrets are outside this repository.

## Remaining limits

- Rate limiting uses in-memory fallback when `REDIS_URL` is absent. It is not coordinated between instances and resets on process restart.
- `deepmerge-ts` is overridden to the patched major; Prisma generation, schema validation and schema application are covered by local verification. CI audits the full client/server dependency trees, including development dependencies. An audit with no reported advisories is not a penetration test.
- Zod was updated to 4.6.7 after audit identified [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) in the previous version; both dependency trees reported zero known vulnerabilities on 2026-10-25 after the update.
- Repository changes cannot confirm actual Render/Neon/Vercel environment values, database backup settings, production admin exposure, or whether old public credentials have already been used. Treat any historically shared default credential as compromised and rotate it.
- Admin second factor is email-based. TOTP/security-key enrollment and recovery codes are a future improvement; protect the admin email account with MFA.
- Remembered-browser cookies are bearer credentials, not hardware identity. Logout removes the current session but deliberately keeps the 24-hour browser trust; clearing site cookies or revoking credentials removes it. Anyone who steals a valid cookie or controls that browser is outside the guarantees of this mechanism.
- Admin audit writes are best-effort application records, not a tamper-proof external security log; failed login alerting and off-site audit retention remain operational improvements.
