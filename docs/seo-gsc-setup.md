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

## 5. Dry-run, then enable writes
```
curl -L "https://totemavise.com/api/cron/seo-striking-distance?dryRun=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```
Expect a JSON report with `strikingCount` + `targets` (position 8–20 queries).
Review the email/report. Then enable the write-side:
```
SEO_AGENT_AUTOFIX=true   # Vercel env
```
This lets the cron create internal-link maillage + rewrite synopses when the
query keyword is absent (max 3/run; title/H1 are **never** auto-edited).

## 6. After activation
- **Monitor 1–2 weeks** via the failure/digest emails and `cron_logs`
  (`/admin/operations`) before tuning `MAX_REWRITES` in `src/lib/seo-autofix.ts`.
- Mark this done in `docs/tech-audit.md` and the cron checklist in `CLAUDE.md`.

## Notes
- The dry-run is callable from anywhere (prod domain is public; the route
  itself checks `CRON_SECRET`).
- `?dryRun=1` always forces report-only, overriding `SEO_AGENT_AUTOFIX`.
