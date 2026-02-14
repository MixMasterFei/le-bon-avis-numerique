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

  while (attempt < 5) {
    try {
      return await operation()
    } catch (error) {
      if (!isPreparedStatementPoolerError(error)) {
        throw error
      }

      lastError = error
      attempt += 1

      if (attempt >= 5) {
        break
      }

      console.warn(`[prisma] Prepared statement desync detected, retry ${attempt}/4`)

      try {
        await prisma.$disconnect()
      } catch {
        // Ignore disconnect errors; retry anyway.
      }

      // Small backoff to let pooled connection state settle.
      await new Promise((resolve) => setTimeout(resolve, attempt * 50))
    }
  }

  throw lastError
}
