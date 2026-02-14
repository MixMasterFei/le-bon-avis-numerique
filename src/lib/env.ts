/**
 * Environment variable validation.
 * Imported in instrumentation.ts to fail fast at startup if required vars are missing.
 */

const requiredVars = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "TMDB_API_KEY",
] as const

const optionalVars = [
  "DIRECT_URL",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "IGDB_CLIENT_ID",
  "IGDB_CLIENT_SECRET",
  "GOOGLE_BOOKS_API_KEY",
  "RESEND_API_KEY",
  "OPENAI_API_KEY",
  "ADMIN_SEED_SECRET",
  "FROM_EMAIL",
  "NEXT_PUBLIC_APP_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const

export function validateEnv() {
  const missing: string[] = []

  for (const key of requiredVars) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[env] Variables d'environnement manquantes :\n${missing.map((k) => `  - ${k}`).join("\n")}\n\nAjoutez-les dans votre fichier .env ou dans les settings Vercel.`
    )
  }

  // Log warnings for optional vars that enhance functionality
  const warnings: string[] = []
  for (const key of optionalVars) {
    if (!process.env[key]) {
      warnings.push(key)
    }
  }

  if (warnings.length > 0 && process.env.NODE_ENV === "development") {
    console.warn(
      `[env] Variables optionnelles manquantes (certaines fonctionnalites seront desactivees) :\n${warnings.map((k) => `  - ${k}`).join("\n")}`
    )
  }
}
