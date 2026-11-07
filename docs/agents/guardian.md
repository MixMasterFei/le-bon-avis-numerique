# 🛡️ Guardian

**Mission.** Keep the site safe, fast and buildable.

## Owns
- Dependencies: `package.json`, `package-lock.json`, Next.js / NextAuth / Prisma upgrades
- Security: `src/lib/security.ts`, rate limits in `src/middleware.ts`, auth (`src/lib/auth.ts`),
  `src/lib/cron-auth.ts`
- Platform: `next.config.ts`, `vercel.json`, CI workflows other than `cron.yml`'s job list,
  performance budgets, Sentry
- Correct HTTP behaviour (status codes, redirects, headers)

## Rules
- Exact version pins; no `npm audit fix --force`.
- No secret in a client component; no debug setting left on in production.
- Never skip or weaken a check to get CI green.

## Open work (2026-11-07)
- **F01 + F08 (assessment of 7 Nov)** on local branch `guardian/f01-f08`, waiting for the
  Director to integrate:
  - F08: the cron credential only opens `CRON_JOB_ROUTES` (`src/lib/cron-credential.ts`,
    exact method + path from `cron.yml` / `vercel.json`; a test fails on drift), fails
    closed on a missing/blank secret, constant-time compare. Totem transcript routes check
    the ADMIN session themselves (`src/lib/admin-session.ts`). **A new scheduled call must be
    added to `CRON_JOB_ROUTES`** or it gets 401 — worth a line in CLAUDE.md's cron checklist.
  - F01: account deletion is one transaction (`src/lib/account-deletion.ts`); every account
    reference in the schema is listed in `USER_REFERENCES` and test-guarded.
  - Verified beyond the unit tests: the transaction, both SQL files and the rollback (two
    injected failures, every row identical after) on a throwaway PostgreSQL 16 built from
    the pre-fix schema; the gates on a local `next dev` (encoded paths: no middleware bypass).
- **Needs Xavier's OK, not applied:** `sql/account_deletion_cascades.sql` (non-destructive FK
  backstop) and `sql/purge_deleted_account_leftovers.sql` (destructive: reviews/comments and
  clicks left by accounts deleted before the fix — run its preview count first).
- Not covered by account deletion, to decide: the newsletter contact in Resend (external,
  not in the transaction); e-mail tokens survive a raw SQL delete of a user (they expire in
  ≤ 24 h); other members' `review_reports` on a deleted review stay pending, as for any
  deleted review.
- The cron credential no longer opens unscheduled tools: `scripts/import-young-kids.ts`
  (one-shot) and `/api/admin/news/reprocess-images` now need an ADMIN session
  (`docs/editorial-sources.md` still says « CRON_SECRET gated »).
- Most `/api/admin/*` routes still rely on the middleware alone (e.g. `dashboard`, which
  returns e-mails and review comments); a route-level `requireAdminSession()` would make
  them robust to a matcher change.
- Released 2026-11-06 (#103): Next 16.4.5, AggregateRating only from our own reviews, demo
  fiches and unused routes removed, no public source maps.
- Vercel env cleanup: `NEXT_PUBLIC_HYDRATION_DEBUG` and `ADMIN_SEED_SECRET` are no longer
  read and can be deleted. Without `SENTRY_AUTH_TOKEN`, browser traces in Sentry are minified.
- Unknown fiches answer **200** (page « introuvable » + noindex) instead of 404, because
  `loading.tsx` streams before `notFound()`.
- Remaining moderate audit items: `minimatch` (tooling only); `@anthropic-ai/sdk` fix 0.91.1
  is outside `^0.90.0`.
- One preview build failed on 2026-11-06 while downloading the Fraunces font from Google
  Fonts (Turbopack `next/font/google`). If it happens again, self-host the fonts with
  `next/font/local`.
