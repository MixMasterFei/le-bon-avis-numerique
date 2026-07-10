# Activate the SEO striking-distance agent (Google Search Console)

The `seo-striking-distance` cron (`src/app/api/cron/seo-striking-distance/route.ts`,
`src/lib/seo-striking-distance.ts`, `src/lib/seo-autofix.ts`) is **coded and
scheduled** (Thu 06:23 UTC) but **inert** until Google Search Console is
connected. `src/lib/gsc.ts` needs four env vars. This is a one-time setup.

## 1. Google Cloud (one-time)
1. Console → **APIs & Services → Library** → enable **Google Search Console API**.
2. **Credentials → Create credentials → OAuth client ID → Desktop app**.
3. Copy the **Client ID** and **Client secret**.

## 2. Get a refresh token
Put the client id/secret in `.env.local`:
```
GSC_OAUTH_CLIENT_ID=...
GSC_OAUTH_CLIENT_SECRET=...
```
Run the helper (opens a consent screen, catches the loopback redirect):
```
npx tsx scripts/get-gsc-refresh-token.ts
```
Authorize with the Google account that owns the Search Console property. It
prints `GSC_OAUTH_REFRESH_TOKEN`.

> If no refresh token is returned, revoke the app at
> https://myaccount.google.com/permissions and re-run (the helper forces
> `prompt=consent`).

## 3. Confirm the property type
Search Console → **Settings** shows whether totemavise.com is a **Domain**
or **URL-prefix** property:
- Domain → `GSC_PROPERTY_URL=sc-domain:totemavise.com`
- URL-prefix → `GSC_PROPERTY_URL=https://totemavise.com/`

## 4. Set Vercel env (Production)
```
GSC_OAUTH_CLIENT_ID
GSC_OAUTH_CLIENT_SECRET
GSC_OAUTH_REFRESH_TOKEN
GSC_PROPERTY_URL
```
Redeploy so the cron picks them up.

## 5. Write-side semantics (since 2026-07-10)
The write-side is **ON by default in production** — no env var needed. It is
**fail-closed everywhere else**: previews and local dev always run report-only
(the route requires `VERCEL_ENV === "production"`), so a missing or mis-scoped
env var can never enable writes outside prod.

- Kill-switch: set `SEO_AGENT_AUTOFIX="false"` in Vercel → report-only.
- One-off dry-run (works in prod too):
```
curl -L "https://totemavise.com/api/cron/seo-striking-distance?dryRun=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```
Writes performed: internal-link maillage (`source:"EXPERT"` edges, editorial
credibility floor), synopsis rewrites when the query keyword is absent
(enriched fiches only), and `seoTitle` `<title>` overrides (also on provisional
fiches with an age). Max 3 synopses + 3 titles/run. The display name (H1/cards)
is **never** auto-edited.

## 6. After activation
- **Monitor 1–2 weeks** via the failure/digest emails and `cron_logs`
  (`/admin/operations`) before tuning `MAX_REWRITES` in `src/lib/seo-autofix.ts`.
- Mark this done in `docs/tech-audit.md` and the cron checklist in `CLAUDE.md`.

## Notes
- The dry-run is callable from anywhere (prod domain is public; the route
  itself checks `CRON_SECRET`).
- `?dryRun=1` always forces report-only, overriding `SEO_AGENT_AUTOFIX`.
