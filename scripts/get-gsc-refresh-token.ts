/**
 * One-time helper to obtain a Google Search Console refresh token for the
 * `seo-striking-distance` cron (src/lib/gsc.ts expects GSC_OAUTH_REFRESH_TOKEN).
 *
 * Prereqs (Google Cloud Console, one-time):
 *   1. Enable the "Google Search Console API".
 *   2. Create an OAuth 2.0 Client ID of type **Desktop app**.
 *   3. Put its id/secret in .env.local as GSC_OAUTH_CLIENT_ID / GSC_OAUTH_CLIENT_SECRET.
 *
 * Then run:  npx tsx scripts/get-gsc-refresh-token.ts
 *   → opens a consent URL (print + best-effort auto-open), catches the
 *     redirect on a loopback port, exchanges the code, prints the refresh
 *     token. Paste it into Vercel as GSC_OAUTH_REFRESH_TOKEN (Production).
 *
 * No secrets are written to disk or committed — the token is only printed.
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import http from "node:http"
import { exec } from "node:child_process"

const CLIENT_ID = process.env.GSC_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.GSC_OAUTH_CLIENT_SECRET
const PORT = 53682 // arbitrary loopback port; must match the OAuth client's allowed redirect
const REDIRECT_URI = `http://localhost:${PORT}`
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"

function fail(msg: string): never {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  fail(
    "Missing GSC_OAUTH_CLIENT_ID / GSC_OAUTH_CLIENT_SECRET in .env.local.\n" +
      "Create a Desktop OAuth client in Google Cloud Console first (see the header of this file).",
  )
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // force a refresh_token even on re-consent
  }).toString()

async function exchangeCode(code: string): Promise<void> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }).toString(),
  })
  const data = (await res.json()) as { refresh_token?: string; error?: string; error_description?: string }
  if (!res.ok || !data.refresh_token) {
    fail(
      `Token exchange failed: ${data.error ?? res.status} ${data.error_description ?? ""}\n` +
        "Tip: if no refresh_token came back, revoke the app's access at " +
        "https://myaccount.google.com/permissions and re-run (prompt=consent forces a fresh one).",
    )
  }
  console.log("\n✓ Success. Set this on Vercel (Production) as GSC_OAUTH_REFRESH_TOKEN:\n")
  console.log("  " + data.refresh_token + "\n")
  console.log(
    "Also set GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET, and GSC_PROPERTY_URL\n" +
      "(domain property → sc-domain:totemavise.com ; URL-prefix → https://totemavise.com/).\n",
  )
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT_URI)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")
  if (!code && !error) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  res.end(
    error
      ? `<p>Échec de l'autorisation : ${error}. Vous pouvez fermer cet onglet.</p>`
      : "<p>Autorisation reçue. Vous pouvez fermer cet onglet et revenir au terminal.</p>",
  )
  server.close()
  if (error) fail(`Authorization denied: ${error}`)
  if (code) await exchangeCode(code)
  process.exit(0)
})

server.listen(PORT, () => {
  console.log(`\nListening on ${REDIRECT_URI} for the OAuth redirect.`)
  console.log("\nOpen this URL in your browser and authorize:\n")
  console.log("  " + authUrl + "\n")
  // Best-effort auto-open (win/mac/linux); ignore failures.
  const opener =
    process.platform === "win32" ? `start "" "${authUrl}"`
    : process.platform === "darwin" ? `open "${authUrl}"`
    : `xdg-open "${authUrl}"`
  exec(opener, () => {})
})
