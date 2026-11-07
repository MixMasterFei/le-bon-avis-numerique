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
- Branch `guardian/f03-f11` (local, not pushed, no PR yet):
  - **Daily Filter Tests are truthful**: no `continue-on-error`, one job per E2E suite, summary
    computed from Playwright's JSON (passed / failed / flaky / retries / infra). The suites were
    rewritten for the current catalogue (URL-as-truth waits, fr-FR thousands, « A → Z », VIP
    age-band rule). Validated once against production on 7 Nov: 68 passed, 1 failed — the
    pagination defect below, until it is deployed.
  - **Pagination fix** in `src/lib/media-queries.ts` (`withStableOrder`: unique `id` as last
    sort key). Same flaw, not fixed, in `src/app/api/db/media/route.ts` and the admin batch
    routes that page with `skip` (Librarian's call).
  - All workflows on Node 24 via `.nvmrc`; `package.json` engines still says `>=22` (tightening
    it changes Vercel's build — Xavier's call).
  - F11: `FamilyRecommendationsSection.test.tsx` no longer leaks requests.
- **Waiting on Xavier**: the `main` ruleset in [release-rules.md](release-rules.md).
- Vercel's edge refused the CI runner during the 7 Nov filter run (« This request was
  blocked »). The suites now name it `[infra]`; if it recurs with one worker, the fix is on the
  Vercel side, not in the tests.

## Open work (2026-11-06)
- Released today (#103): Next 16.4.5, AggregateRating only from our own reviews, demo fiches
  and unused routes removed, no public source maps.
- Vercel env cleanup: `NEXT_PUBLIC_HYDRATION_DEBUG` and `ADMIN_SEED_SECRET` are no longer
  read and can be deleted. Without `SENTRY_AUTH_TOKEN`, browser traces in Sentry are minified.
- Unknown fiches answer **200** (page « introuvable » + noindex) instead of 404, because
  `loading.tsx` streams before `notFound()`.
- Remaining moderate audit items: `minimatch` (tooling only); `@anthropic-ai/sdk` fix 0.91.1
  is outside `^0.90.0`.
- One preview build failed on 2026-11-06 while downloading the Fraunces font from Google
  Fonts (Turbopack `next/font/google`). If it happens again, self-host the fonts with
  `next/font/local`.
