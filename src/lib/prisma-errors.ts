import { Prisma } from "@prisma/client"

/**
 * Prisma P2022: the column does not exist in the database. The ONLY error
 * that deploy-order guards (code deployed before its SQL migration ran) are
 * allowed to swallow — anything else is a real failure and must bubble.
 */
export function isMissingColumnError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2022"
}
