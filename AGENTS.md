# AGENTS — WorkAhead (FOR AI ONLY)

> opencode / Muse Spark entrypoint. For full context see `.opencode/memory/ARCHITECTURE.md:1`. This file is read on `analyze my repo/folder`.

## Project
WorkAhead — Mongolian exam prep. `Orgil1221/workahead` private, `main`. Deploy `work-ahead-api.onrender.com` + `workahead.me` (Vercel) + Neon + `keep-alive 01-06 UB` `570h/750h`.

## Commands
```
server: npm run dev (4000) | npm run db:push | npm run db:generate | node prisma/seed.js | node scripts/import.js ../files/x.json --program=<id>
client: npm run dev (5173 proxy /api→4000 or VITE_API_PROXY) | npm run build (vite 6, 6s)
full: powershell -File ./start-dev.ps1
```

## Conventions
- `choices` 4 `A-D` + `correctChoice` if `type=test`; else `needsReview` `importService.js:20`
- `transactionId wa-{8hex}` `payments.js:83`
- `x-csrf-token` from `GET /api/auth/csrf` `client/src/api/client.js:76`
- `LaTeX $...$` only, `exam_id` idempotent

## Memory Protocol (auto)
- Architecture: `.opencode/memory/ARCHITECTURE.md`
- Rolling: `.opencode/memory/MEMORY.md` (last 5, TODO)
- Changelog: `.opencode/memory/CHANGELOG.md` auto via `.opencode/scripts/log-change.mjs` on `post-commit` (you don't write manually)
- On every significant PR, update `ARCHITECTURE.md` + let hook append `CHANGELOG.md`

## How to Continue
- See `.opencode/memory/MEMORY.md: How to Continue` section for file pointers per task.
