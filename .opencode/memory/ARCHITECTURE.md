# WorkAhead — Architecture Memory (FOR AI ONLY)

> This file is for Muse Spark / opencode to answer `analyze my repo/folder` in <30s. Human docs: `README.md:119`, `DEPLOY.md:73`, `docs/AI_IMPORT_PROMPT.md:101`. Keep this file <150 lines and update after every architecture PR.

## Purpose
Mongolian university entrance/midterm prep platform (MUIS focused). Students practice exams; admins import/manage catalog; payments unlock 30-day plans.

## Stack
- **Client:** `client/:1` React 18 + Vite 6 + react-router 6, `katex 0.18 + mathlive 0.110`, `theme.css:35446` Fraunces/IBM Plex Mono/Inter, mobile-first `StudentLayout.jsx:15` + `TabBar.jsx:42`, glass `blur(16px)`
- **Server:** `server/src/index.js:94` Express 4 + `helmet` + `doubleCsrf` + `rateLimitFlexible.js:54` (Redis|Memory), `zod 4.4`, `prisma 6.2`
- **DB:** `server/prisma/schema.prisma:1` Postgres Neon, 8 models: `University→Program→Exam→Question→Flag/Bookmark/TestAttempt→AttemptAnswer`, plus `AcademicProgram` (MUIS majors), `Plan/PlanExam/PaymentTransaction`, `Notification`, `EmailOtp/User`
- **Services:** `server/src/services/bonum.js:92` (QPAY/E_COMMERCE HMAC `x-checksum-v2`), `gemini.js:58` (AI grade), `email.js:80` (Resend→SMTP→console), `importService.js:150` (JSON/CSV), `shuffle.js:35` (`seed=attemptId+questionId`)
- **Deploy:** `render.yaml:12` Docker `work-ahead-api` `health /api/health`, `vercel.json:9` `client/dist` proxy `/api/*`, `docker-compose.yml:62` local pg16+redis, `start-dev.ps1:210`
- **Push:** `server/src/routes/push.js:104` (`public-key/subscribe/unsubscribe/my/test/admin/send`) + `services/push.js:56` (`web-push` VAPID, dead-sub cleanup) ↔ `client/public/sw.js:27` + `client/src/push.js:98` + test UI `Notifications.jsx` (student) / `Notify.jsx` (admin self-test), `PushSubscription` model, `vercel.json:12` sw no-cache

## How to Improve (where to touch)
- **Landing identity:** keep the original “Монгол Улсын Их Сургуулийн шалгалтад бэлдэж буй оюутнуудад зориулав” hero copy and shared orange-red `--accent` for headings and primary actions. Weather/holiday themes change decorative effects, not the brand palette; dark-mode CTA text stays high-contrast.
- **Public landing:** `Landing.jsx` + scoped `Landing.css` provide the responsive landing, interactive limit example (answer 3), real public catalog counts, FAQ and seasonal presentation. `LandingAtmosphere.jsx` keeps the original production snow's three solid-circle layers, colors, density, sizes and drift/speed (also used under New Year decorations); rain and pine/baubles/lights are upgraded. Canvas is capped at 30fps with hidden-tab suspension and reduced-motion/pause support. Auto mode respects the admin theme first, then Ulaanbaatar's Dec15–Jan10 holiday window or weather; failures do not invent catalog statistics.
- **Landing theme control:** only the existing admin `LandingThemeEditor` → `/api/admin/settings/landing-theme` controls the saved theme; landing reads it from `/api/programs-public`. No visitor theme switch or query override exists, including locally. Development-only `/preview/landing` remains for viewing while signed in without changing auth; production has no preview route and normal `/` keeps its authenticated redirect.
- **Student exam flow:** `Study.css` + `StudyUI.jsx` unify course exam lists, mode selection, question runner, result breakdown, history and wrong-question review. `AttemptRunner.jsx` restores saved answers, queues per-question saves, captures MathLive input immediately, blocks finishing on failed saves, and uses a deadline timer with latest answers. `StudyResult.jsx` renders actual server scores and mode-aware solutions. Student `Home.jsx` and its original content width are intentionally unchanged (user requested rollback).
- **Exam UI preview:** development-only `/preview/study` opens the sample mathematics exam list. `StudyContext.jsx` defaults to the existing authenticated API; only `StudyPreview.jsx` injects the session-local fixture API from `studyPreviewData.js`. No real attempts, payments, auth changes, or AI calls are made by the preview. Existing profile/payment previews remain unchanged.
- **Student payments UI:** `Payment.jsx` loads plans/history separately and verifies return transactions independently of URL cleanup, with bounded sequential polling and manual retry. `PaymentView.jsx` + `Payment.css` add all-plan selection, green order summary, status-filtered history, pending-transaction checks, and a native dialog before the existing Bonum redirect. Duration and amount come from API data. Development-only `/preview/payment` (`PaymentPreview.jsx`) is labeled sample data; its checkout creates no invoice and uses no account APIs.
- **Student profile:** `Profile.jsx` handles authenticated API calls; `ProfileView.jsx` + `Profile.css` provide responsive identity, personal details/editor, password confirmation, appearance settings, plan status, and support. Owned plans take priority; loading/error/empty states stay distinct. Development-only `/preview/profile` uses `ProfilePreview.jsx` with in-memory sample edits, real mobile header/tab bar, and five selectable plan states. Preview does not change auth state or call account/payment APIs.
- **Student progress dashboard:** `client/src/pages/student/Dashboard.jsx` loads history + topic totals with loading/error/retry states. `DashboardView.jsx` + `Dashboard.css` render period filters (7/30/all), inspectable score chart, weakest topics, recent attempts, and seven-day activity. `dashboardData.js` holds calendar filtering and metric calculations. Topics remain all-time and are labeled separately from the period filter. Topic denominator in `server/src/routes/attempts.js` counts repeated answers, avoiding percentages above 100 from repeated attempts.
- **Local dashboard preview:** development-only `/preview/dashboard`, lazy-loaded `DashboardPreview.jsx`, labeled sample data with populated/empty states and theme toggle. No auth bypass or fixtures in the production route. Student dashboard remains `/student/dashboard` with real API data. Landing example uses `$\\lim_{x\\to 0}\\frac{\\sin(3x)}{\\sin x}$`, answer 3.
- **Billing:** `client/src/pages/student/Payment.jsx:206` (hero + modal) ↔ `server/src/routes/payments.js:234` (`checkout 20/h`, daily caps `200/1399800`, `mock fail-closed` `ALLOW_MOCK_PAYMENTS`, webhook `POST /api/payments/webhook:172`)
- **Exams:** `AttemptRunner.jsx` + `StudyResult.jsx` preserve `type=='test'||(isTest&&hasChoices)` ↔ `server/src/routes/attempts.js` (`mode TIMED→OPEN vs TEST`, answer save, AI grading, finish). `ExamDetail.jsx` starts the selected mode through the existing attempts API; no backend grading policy changes.
- **Catalog:** `server/src/routes/admin/catalog.js:13k` + `client/src/pages/admin/Catalog.jsx:22k` (University/Program/Exam/Question CRUD + reorder)
- **Auth:** `server/src/routes/auth.js:13k` (`OTP 6-digit 10m 60s cooldown` `EmailOtp`, `bcrypt 10`, `JWT 7d + jti` `wa_token httpOnly`), `server/src/middleware/auth.js:1` (session check `DEVICE_KICKED`), `server/src/services/session.js:33` (`UserSession userId+deviceType unique` → 1 DESKTOP + 1 MOBILE, `X-Device-Type` else UA parse, login kicks same-type)
- **Import:** `docs/AI_IMPORT_PROMPT.md:101` single prompt dual-mode (`type open/test + choices[4] A-D + correct_choice`, `LaTeX $...$ only`, 60-100pts) → `server/src/services/importService.js:20` validates 4+correct, `server/scripts/import.js:1`

## Conventions (must follow)
- `choices` always 4 (`A-D`) + `correctChoice A-D` if `type=test` or `choices` present; else `needsReview true`
- `transactionId wa-{8hex}` unique, `callback ${PUBLIC_BASE_URL}/student/payment?txn=` `payments.js:114`
- `x-csrf-token` from `GET /api/auth/csrf` for POST (`client/src/api/client.js:76`), `Bearer` from `localStorage wa_token` fallback
- `format OPEN|TEST` derived from `mode` at `attempts.js:44`

## Pitfalls (don't repeat)
- `C1 mock auto-PAID in prod` fixed `payments.js:97` `ALLOW_MOCK_PAYMENTS`; `C2 RATE_LIMIT_DISABLED only dev` `rateLimitFlexible.js:28`; `C3 daily caps count only PAID` `payments.js:71` + `expirePending.js:1` 5m; `C4 nodemailer/resend` missing from `server/package.json:15` fixed; `CORS_ORIGIN` required in prod `index.js:30`; `exams.js:52` leaks `choices` for OPEN — client now gates via `isTest` `AttemptRunner.jsx:352`; `profile badge overflow` `Profile.jsx:93` ellipsis fix `375449b`

## Commands
```
server: npm run dev (4000), npm run db:push, npm run db:generate, node prisma/seed.js, node scripts/import.js ../files/x.json --program=<id>
client: npm run dev (5173 proxy /api→4000 or https://work-ahead-api.onrender.com via VITE_API_PROXY), npm run build (vite 6)
local full: powershell -File ./start-dev.ps1  (pg at $TEMP\opencode\pgsql)
```

## Docs Index
- Human: `README.md:119`, `DEPLOY.md:73`, `docs/AI_IMPORT_PROMPT.md:101`
- AI private: `.opencode/memory/ARCHITECTURE.md` (this), `.opencode/memory/MEMORY.md`, `.opencode/memory/CHANGELOG.md`
