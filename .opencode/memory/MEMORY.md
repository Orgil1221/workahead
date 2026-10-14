# WorkAhead — AI Memory (rolling, FOR AI ONLY)

> Last updated: 2026-09-20 16:30 UTC (commit db3ed70). This is the 5-line continuation context for opencode. Update this file after every significant PR (payment/billing, exam modes, catalog, auth). Keep <80 lines.

## Last 5 Changes
- `2026-09-20 01:15 db3ed70 fix(exam): zadgai OPEN shows AI review instead of TEST choices` — `AttemptRunner.jsx:352` `ResultView` `hasChoices` ignored `isTest`, now `isQTest = type=='test'||(isTest&&hasChoices)` — `TIMED/OPEN` correctly shows `givenAnswer/answer/modelSolution/AI feedback`
- `2026-09-20 00:53 3123814 fix(payment): show Бүх шалгалт instead of 0` — `Payment.jsx:123` `Profile.jsx:243` `examCount? -> Бүх шалгалт`
- `2026-09-20 00:44 375449b fix(profile): truncate long badge` — `Profile.jsx:93` ellipsis `maxWidth100%` prevents screen overflow / tab bar enlarge
- `2026-09-20 00:37 4158265 feat(payment): profile declutter + payment tab` — `Profile.jsx:335` 1180→600px, `Payment.jsx:206` hero glass, `StudentLayout.jsx:9` tabs `Мэдэгдэл→Төлбөр` (profile stays middle 3/5), `MobileHeader` bell only for notifications
- `2026-09-18 17:15 4ebbfb9 fix(bonum): BASE_URL apis.bonum.mn` — doc says prod is `https://apis.bonum.mn` (with s), was `api.bonum.mn`

## Active TODO (for next session)
- Local uncommitted dashboard upgrade (2026-10-14): new student dashboard, development-only `/preview/dashboard`, corrected landing limit example, repeated-attempt topic denominator fix. Frontend preview uses sample data; validate authenticated API flow separately before deployment. See `ARCHITECTURE.md` for file pointers.
- [ ] Verify `BONUM_API_BASE_URL` prod vs test for `terminal 17173149` — `NO_AUTH ${invalid.token}` seen `2026-09-18 401` if `APP_SECRET` mismatched; ask Bonum with `traceId`
- [ ] `JWT 7d → 15m+refresh` `auth.js:12` (H1) if higher security needed
- [ ] `CSP` enable `index.js:24` + `MathText XSS DOMPurify` `H6`
- [ ] Consider `600kB chunk` split `vite` warning `client/dist/assets/index-*.js 1419kB`

## How to Continue
- If user says `profile clutter` → touch `Profile.jsx:335` + `Payment.jsx:206` + `StudentLayout.jsx:9`
- If `exam bug` → `AttemptRunner.jsx:352` + `server/src/routes/attempts.js:69` + `services/gemini.js:11`
- If `payment 502` → `server/src/routes/payments.js:97` + `services/bonum.js:31` + `client/src/api/client.js:91` (GATEWAY_* no-retry)
- Always run `client: npx vite build` (6s) before push; `server: node --check src/index.js`

## Quick Context for `analyze`
- Repo: `Orgil1221/workahead` private, `main`, `~82/100` security after `2497d4d`, `58` before
- Deploy: `work-ahead-api.onrender.com` + `workahead.me` (Vercel), `Neon`, keep-alive `01-06 UB sleep` `.github/workflows/keep-alive.yml:30` 750h fits `570h`
- Local: `start-dev.ps1` or `npm run dev` client 5173 proxy `/api` → `https://work-ahead-api.onrender.com` via `VITE_API_PROXY`

## Notes (auto-appended by log-change.mjs on commit)
<!-- below is appended automatically; do not edit manually above this line -->
