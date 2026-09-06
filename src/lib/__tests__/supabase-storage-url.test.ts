import { describe, expect, it } from "vitest"
import { normalizeSupabaseUrl } from "../supabase-storage"

// Every upload since May 2026 died on a 404 because the configured URL was the
// PostgREST endpoint, not the project root. The normaliser is what makes the
// storage client correct whichever URL the dashboard was copied from.
describe("normalizeSupabaseUrl", () => {
  const root = "https://acddamjcudefinvqxuvp.supabase.co"

  it("keeps a correct project root unchanged", () => {
    expect(normalizeSupabaseUrl(root)).toBe(root)
  })

  it("strips the REST suffix that broke production", () => {
    expect(normalizeSupabaseUrl(`${root}/rest/v1`)).toBe(root)
    expect(normalizeSupabaseUrl(`${root}/rest/v1/`)).toBe(root)
  })

  it("strips the other service suffixes and trailing slashes", () => {
    expect(normalizeSupabaseUrl(`${root}/storage/v1`)).toBe(root)
    expect(normalizeSupabaseUrl(`${root}/auth/v1/`)).toBe(root)
    expect(normalizeSupabaseUrl(`${root}/`)).toBe(root)
    expect(normalizeSupabaseUrl(`  ${root}  `)).toBe(root)
  })

  it("returns null for missing or unparsable values", () => {
    expect(normalizeSupabaseUrl(undefined)).toBeNull()
    expect(normalizeSupabaseUrl("")).toBeNull()
    expect(normalizeSupabaseUrl("not a url")).toBeNull()
  })
})
