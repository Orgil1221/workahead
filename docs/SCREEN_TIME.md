# Student Screen Time

## Meaning
The admin dashboard reports logged-in students' estimated active foreground time, not time since login, page-open time, or exam duration. Landing, admin routes, and development previews are excluded.

- Visible and focused student tab only; pause after 120 seconds without pointer, keyboard, touch, or scroll activity.
- Sample elapsed monotonic time every second. Timer gaps over five seconds are discarded rather than treated as activity.
- Synchronize timestamps with the server when the tracker starts. Upload about every 30 seconds and flush with a CSRF-protected keepalive request on hiding/leaving.
- Keep unsent samples in memory for at most four minutes. Offline activity, interrupted uploads, and browser termination can undercount; this is product analytics, not an attendance or billing clock.
- Interaction content, keys, answers, screenshots, page URLs and device identifiers are not stored by this feature.

## Storage and deduplication
`UsageMinute` has a composite key `(userId, minuteAt)` and a 60-bit `BigInt secondsMask`. Each bit represents one observed second in that UTC minute. Atomic PostgreSQL bitwise-OR upserts merge retries and overlapping tabs/devices without double-counting. One account cannot contribute more than 60 seconds to a minute.

The authenticated user ID is set by the server, never accepted from the body. POST batches allow 1–20 intervals, each at most 120 seconds, no older than five minutes; small future clock tolerance is clamped to server time. Normal authentication/session validation, CSRF protection and per-user rate limits apply.

The admin API exposes aggregates only, not individual user IDs. Records older than 35 days are deleted by daily cleanup and a startup cleanup. User deletion cascades to usage rows. The public Terms page describes this collection.

## API
- `GET /api/usage`: student-only server clock synchronization.
- `POST /api/usage`: student-only `{ intervals: [{ start, end }] }`, epoch milliseconds.
- `GET /api/admin/usage?days=1|7|30`: admin-only report; defaults to seven days, including today.
- `GET /api/admin/stats`: existing overview KPIs; no longer computes the removed weak-topic report. Keeps an empty `weakTopics` field for older cached clients and frontend rollback compatibility.

Daily buckets and hourly load use `Asia/Ulaanbaatar` (UTC+8). Total active students are distinct over the period. “Per student / active day” divides seconds by the sum of daily distinct students, not all registered accounts. Hourly bars are sums over the selected period, not per-hour daily averages. Peak/quiet hours exclude hours with no measurement coverage. Today's data is partial.

`SiteSetting.usageTrackingStartedAt` records the first accepted sample minute. Earlier days are unmeasured, not zero. There is no inferred/backfilled history. The independent usage panel has loading, retry/error and empty states.

## Rollout
1. Generate the Prisma client and build the frontend.
2. Apply the additive `20261016000000_add_usage_minutes` migration with the project's existing database deployment workflow. The existing Render Docker startup uses Prisma schema push, which also creates this table.
3. Deploy the Express backend and frontend. Confirm the new authenticated endpoints and schema are available; a healthy generic health endpoint alone does not prove schema readiness.
4. Use a normal student session, stay active for over 30 seconds, then refresh the admin usage panel.
5. Development-only `/preview/admin` has labeled sample usage for visual inspection; it does not send telemetry and is excluded from production.

No production database commands should be run against a guessed/local environment URL. Rolling back the frontend stops new tracker activity; the additive table can remain in place safely.

## Verification
Local verification covers the migration and service SQL in isolated PostgreSQL (PGlite), duplicate/overlapping/concurrent intervals, Ulaanbaatar midnight, distinct user-days, retention, cascading deletion, idle/hidden/suspended clocks, real JWT/session/role and CSRF middleware, and the browser-to-database-to-dashboard flow.

Browser lifecycle design follows [Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) and [keepalive delivery guidance](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon). PostgreSQL performs the [bitwise merge](https://www.postgresql.org/docs/16/functions-bitstring.html) atomically.
