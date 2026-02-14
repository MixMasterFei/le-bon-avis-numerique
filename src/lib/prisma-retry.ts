import { prisma } from "@/lib/prisma"

function isPreparedStatementPoolerError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("prepared statement") &&
    (message.includes("already exists") || message.includes("does not exist"))
  )
}

/**
 * Retry after reconnect when pooled Postgres prepared statements desync.
 */
export async function withPrismaRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0
  let lastError: unknown

  while (attempt < 3) {
    try {
      return await operation()
    } catch (error) {
      if (!isPreparedStatementPoolerError(error)) {
        throw error
      }

      lastError = error
      attempt += 1

      if (attempt >= 3) {
        break
      }

      console.warn(`[prisma] Prepared statement desync detected, retry ${attempt}/2`)

      try {
        await prisma.$disconnect()
      } catch {
        // Ignore disconnect errors; retry anyway.
      }
    }
  }

  throw lastError
}
