/**
 * Test helper: evaluates a Prisma `where` object against an in-memory row, so
 * a test can run the REAL selection predicates of a queue (and simulate
 * several scheduled runs) instead of only pinning their shape.
 *
 * Covers the subset the catalogue queues use — AND / OR / NOT, equality,
 * `equals`, `not`, `in`, `notIn`, `lt`, `lte`, `gt`, `gte` — with SQL null
 * semantics (a NULL column never satisfies a comparison, `not: x` included).
 * Anything else throws, as does a field the row doesn't have: a test must not
 * pass because the helper silently ignored part of a predicate.
 */

type Row = Record<string, unknown>
type Where = Record<string, unknown>

const list = (value: unknown): Where[] => (Array.isArray(value) ? value : [value]) as Where[]

const comparable = (value: unknown) => (value instanceof Date ? value.getTime() : value) as number | string | boolean

const isScalar = (value: unknown) => value === null || value instanceof Date || typeof value !== "object"

function compare(value: unknown, operand: unknown, test: (a: number | string | boolean, b: number | string | boolean) => boolean) {
  return value != null && operand != null && test(comparable(value), comparable(operand))
}

function fieldMatches(value: unknown, condition: unknown): boolean {
  if (isScalar(condition)) {
    return condition === null ? value == null : value != null && comparable(value) === comparable(condition)
  }
  return Object.entries(condition as Where).every(([operator, operand]) => {
    switch (operator) {
      case "equals":
        return fieldMatches(value, operand)
      case "not":
        return operand === null ? value != null : value != null && !fieldMatches(value, operand)
      case "in":
        return value != null && (operand as unknown[]).some((o) => comparable(o) === comparable(value))
      case "notIn":
        return value != null && !(operand as unknown[]).some((o) => comparable(o) === comparable(value))
      case "lt":
        return compare(value, operand, (a, b) => a < b)
      case "lte":
        return compare(value, operand, (a, b) => a <= b)
      case "gt":
        return compare(value, operand, (a, b) => a > b)
      case "gte":
        return compare(value, operand, (a, b) => a >= b)
      default:
        throw new Error(`matchesWhere: unsupported operator "${operator}"`)
    }
  })
}

export function matchesWhere(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (condition === undefined) return true
    if (key === "AND") return list(condition).every((w) => matchesWhere(row, w))
    if (key === "OR") return (condition as Where[]).some((w) => matchesWhere(row, w))
    if (key === "NOT") return list(condition).every((w) => !matchesWhere(row, w))
    if (!(key in row)) throw new Error(`matchesWhere: row has no field "${key}"`)
    return fieldMatches(row[key], condition)
  })
}
