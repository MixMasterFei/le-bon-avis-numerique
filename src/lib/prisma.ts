import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getRuntimeDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return undefined
  let selectedUrl = databaseUrl

  // Supabase transaction pooler can trigger prepared statement issues with Prisma in some environments.
  // Prefer DIRECT_URL when available for runtime stability.
  if (databaseUrl.includes("pooler.supabase.com") && process.env.DIRECT_URL) {
    selectedUrl = process.env.DIRECT_URL
  }

  // Otherwise, force pooler-safe params.
  if (selectedUrl.includes("pooler.supabase.com")) {
    const parsed = new URL(selectedUrl)
    if (!parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true")
    }
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1")
    }
    if (!parsed.searchParams.has("statement_cache_size")) {
      parsed.searchParams.set("statement_cache_size", "0")
    }
    return parsed.toString()
  }

  return selectedUrl
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(getRuntimeDatabaseUrl()
      ? { datasources: { db: { url: getRuntimeDatabaseUrl()! } } }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
