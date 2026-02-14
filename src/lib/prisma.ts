import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getRuntimeDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return undefined

  // Otherwise, force pooler-safe params.
  // NOTE: runtime should always use DATABASE_URL; DIRECT_URL is for migrations only.
  if (databaseUrl.includes("pooler.supabase.com")) {
    const parsed = new URL(databaseUrl)
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

  return databaseUrl
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
