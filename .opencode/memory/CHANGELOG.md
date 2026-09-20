# WorkAhead — Changelog (auto, FOR AI ONLY)

> Auto-appended by `.opencode/scripts/log-change.mjs` on `post-commit` and by `opencode` on `analyze`. Format: `YYYY-MM-DD HH:mm UTC | commit files | summary`. Keep last 50 entries. Human changelog: see `CHANGELOG.md` if created.

## 2026-09-20
- `2026-09-20 01:15 UTC | db3ed70 | client/src/pages/student/AttemptRunner.jsx | fix(exam): zadgai OPEN shows AI review instead of TEST choices` — ResultView hasChoices ignored isTest, now isQTest = type=='test'||(isTest&&hasChoices)
- `2026-09-20 00:53 UTC | 3123814 | client/src/pages/student/Payment.jsx, Profile.jsx | fix(payment): show Бүх шалгалт instead of 0 шалгалт`
- `2026-09-20 00:44 UTC | 375449b | client/src/pages/student/Profile.jsx | fix(profile): truncate long program/major badge to prevent overflow`
- `2026-09-20 00:37 UTC | 4158265 | client/src/App.jsx, StudentLayout.jsx, TabBar.jsx, Profile.jsx, Payment.jsx, vite.config.js | feat(payment): profile declutter + payment tab (clean AI-style) — 5 files, 265ins`
- `2026-09-18 17:15 UTC | 4ebbfb9 | server/.env.example, server/src/services/bonum.js | fix(bonum): correct prod BASE_URL to https://apis.bonum.mn (with s per docs)`
- `2026-09-18 17:10 UTC | 646d32e | server/src/services/bonum.js | fix(bonum): trim secret/terminal and capture raw 401 body`
- `2026-09-18 16:41 UTC | c573a06 | server/src/services/bonum.js | fix(bonum): expose auth detail on 401 for debugging`
- `2026-09-18 16:37 UTC | 249be24 | server/src/routes/payments.js, client/src/api/client.js, Profile.jsx | fix(payment): expose Bonum detail on GATEWAY_ERROR for debugging`
- `2026-09-18 16:35 UTC | c60bd01 | client/src/api/client.js | fix(client): don't retry 502 GATEWAY_* as Render cold start`
- `2026-09-18 16:03 UTC | c0278e3 | client/src/pages/student/Profile.jsx | fix(client): Profile buy no-redirect toast hardening`
- `2026-09-18 15:31 UTC | 38e2ec8 | server/package-lock.json | chore: update server lock for nodemailer/resend (fix npm ci)`
- `2026-09-18 12:13 UTC | 2497d4d | server/.env.example, package.json, index.js, rateLimitFlexible.js, payments.js, jobs/expirePending.js, keep-alive.yml | security(payment): harden merchant gateway + rate limit + keep-alive 01-06 sleep (7 files, 153ins) 58->82/100`

## 2026-09-18 — earlier (seeded from git log)
- `2026-09-12 23:51 9704691 feat(admin): users PUT-d academicProgramId zasah`
- `2026-09-12 23:48 be1332f feat(academic): 93 MUIS majors`
- `2026-09-11 21:47 da9f164 fix(academic): registration fallback-g hasaha`
- `2026-09-11 17:52 6b23dd4 fix(auth): whitelist seed endpoint for CSRF`
