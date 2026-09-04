# Launch-blocker fixes — 4 September 2026

Scope: the six urgent correctness, consent and access-control findings from the website audit. Page composition, navigation, visual design and information architecture are preserved.

## Corrected behavior

- Curated game guides match complete, explicitly selected titles; ambiguous records are omitted. Among Us cannot resolve to The Wolf Among Us. Franchise rows name the actual release being rated.
- Homepage recommendations use the youngest selected age, including the lower edge of an age band. Current age constraints apply immediately to cached and in-flight results, streaming rails and personalized recommendations.
- Film, series and game pagination accepts valid pages beyond 100; the actual filtered catalogue count determines the last page. Numeric syntax and database offsets remain bounded.
- Public media API requests have bounded pagination and fail safely without dropping age or title filters when the database is unavailable.
- Review creation and updates validate that a supplied family member belongs to the signed-in user.
- Analytics load only after consent. Changes propagate between controls and tabs; every later event rechecks the current choice. Plausible pageviews/custom events use its Events API with query strings and fragments stripped from page/referrer URLs. Automatic Plausible engagement metrics are intentionally omitted. Marketing controls accurately show that the site does not use them.
- Session validation checks current database identity/role and a keyed credential fingerprint, including Auth.js's direct OAuth decode path. Password resets, account deletion and staff-role changes take effect on subsequent authenticated requests. Reset tokens are consumed atomically with password changes.
- New Google identities cannot take over existing accounts through an untrusted email match. Automatic email linking requires verified Gmail or Google Workspace claims; external mailbox collisions require signing into the existing account first. When Google verifies an account that was still unverified, any old credentials password is cleared to prevent account pre-hijacking; that user signs in with Google. Already-verified credentials passwords and already-linked Google subjects retain their normal login flow.
- Authentication and paid AI interpretation/chat hourly limits use atomic, shared PostgreSQL counters. Trusted Vercel IP headers replace the spoofable Cloudflare-header preference. Missing counters or database failures block protected work instead of disabling the throttle.

## Deployment order

1. Apply `prisma/migrations/manual/014_auth_rate_limits.sql` to each database used by the intended deployment **before** deploying the application. It adds one table and index, enables RLS and revokes anonymous/authenticated API access. It is safe to apply while the previous application version is running. Use the existing privileged server connection; do not grant browser roles access to the counter table.
2. Deploy the application. Existing sessions will sign out once because old JWTs have no credential fingerprint. Users sign in again normally; no password reset is required. Existing `AUTH_SECRET` (or its supported Auth.js alias) is reused.
3. Smoke-test a valid login, password reset, existing/new Google login, permission removal and two-household review rejection in the intended deployment environment. Check consent accept/refuse/revoke and navigation after re-acceptance.

The migration is supplied, not applied to production. Until it is applied, protected authentication and paid API requests return a retryable 503; discovery falls back to ordinary keyword results. No production data, deployment or feature flags were changed during implementation.

## Validation and limits

Local validation passed: the full Vitest run reported **1,006 tests across 96 files**; the final security suites also passed, including 16 paid-limit cases. ESLint returned zero errors and four existing unused-variable warnings. The final production build passed, including its TypeScript check, using placeholder credentials rather than the live database. One existing schema-parser test was made compatible with Windows CRLF line endings.

Regression tests cover title identity, mixed ages and stale caches, pagination/API errors, two-household ownership, current-role/session revocation, encrypted-JWT OAuth paths, Google linking claims, atomic reset-token usage, consent and sensitive URL stripping, and shared throttles.

The exact counter module and migration were also exercised against PostgreSQL 18.3 through temporary PGlite 0.5.8: repeatable migration, denied browser-role access, 20 requests admitting exactly five, hour windows, independent namespaces, expiry reset, bounded cleanup and failure without the table. PGlite serializes through one connection; this does not substitute for a real multi-connection/Prisma/Supabase deployment check.

General catalogue, board and ballot flood controls remain process-local. Existing daily AI totals remain count-based safeguards rather than atomic financial reservations. Their redesign is separate from the shared authentication/paid-request limits implemented here. Editorial calibration, human review of age guidance, performance work and structural UX changes remain outside this patch.
