// Prisma's PostgreSQL skip argument is a signed 32-bit integer. Validate the
// actual offset, rather than imposing an arbitrary limit on catalogue size.
const MAX_DATABASE_OFFSET = 2_147_483_647

export function parsePositiveInteger(raw: string | null | undefined, fallback: number): number | null {
  if (raw == null) return fallback
  if (!/^[1-9]\d*$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : null
}

export function parsePagination(
  rawPage: string | null | undefined,
  rawLimit: string | null | undefined,
  { defaultLimit = 20, maxLimit = 100 } = {},
): { page: number; limit: number; skip: number } | null {
  const page = parsePositiveInteger(rawPage, 1)
  const limit = parsePositiveInteger(rawLimit, defaultLimit)
  if (page === null || limit === null || limit > maxLimit) return null
  const skip = (page - 1) * limit
  if (!Number.isSafeInteger(skip) || skip > MAX_DATABASE_OFFSET) return null
  return { page, limit, skip }
}

export function parseCataloguePage(rawPage: string | null | undefined): number | null {
  return parsePagination(rawPage, null, { defaultLimit: 24 })?.page ?? null
}
