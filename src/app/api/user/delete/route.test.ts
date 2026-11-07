// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { auth, deleteUserAccount } = vi.hoisted(() => ({ auth: vi.fn(), deleteUserAccount: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth }))
vi.mock("@/lib/account-deletion", () => ({ deleteUserAccount }))

import { DELETE } from "./route"

const summary = {
  reviews: 2, communityAgesRecomputed: 1, recoClicks: 3,
  searchesDeleted: 2, searchCostRowsAnonymised: 1, verificationTokens: 2,
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.mockResolvedValue({ user: { id: "parent-a" } })
  deleteUserAccount.mockResolvedValue(summary)
})
afterEach(() => vi.restoreAllMocks())

describe("DELETE /api/user/delete", () => {
  it("refuses a request without a session", async () => {
    auth.mockResolvedValue(null)
    expect((await DELETE()).status).toBe(401)
    expect(deleteUserAccount).not.toHaveBeenCalled()
  })

  it("deletes exactly the signed-in account, in one call", async () => {
    const response = await DELETE()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(deleteUserAccount).toHaveBeenCalledOnce()
    expect(deleteUserAccount).toHaveBeenCalledWith("parent-a")
  })

  it("answers 404 when the account is already gone", async () => {
    deleteUserAccount.mockResolvedValue(null)
    expect((await DELETE()).status).toBe(404)
  })

  it("answers 500 on a failure (rolled back), without the account id in the log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const failure = Object.assign(new Error('Invalid `prisma.user.delete()` invocation: { where: { id: "parent-a" } }'), {
      name: "PrismaClientKnownRequestError",
      code: "P2034",
    })
    deleteUserAccount.mockRejectedValue(failure)

    const response = await DELETE()

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Erreur lors de la suppression du compte" })
    expect(log).toHaveBeenCalledOnce()
    expect(JSON.stringify(log.mock.calls)).not.toContain("parent-a")
    expect(JSON.stringify(log.mock.calls)).toContain("P2034")
  })
})
