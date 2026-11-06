import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@prisma/client"

// ---------------------------------------------------------------------------
// The ledger decides whether an agent's write reaches the catalogue. What is
// pinned here is every way it must NOT: a queued proposal that slips through,
// an approval that overwrites a human edit, a double click applied twice.
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentAutonomy: { findUnique: vi.fn() },
    agentAction: {
      create: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    agentRun: { create: vi.fn(), update: vi.fn() },
    mediaItem: { updateMany: vi.fn(), findUnique: vi.fn() },
  },
}))

import { prisma } from "@/lib/prisma"
import { decideAgentAction, proposeAgentAction, startAgentRun } from "@/lib/agent-ledger/ledger"

const db = vi.mocked(prisma, true)

const proposal = {
  run: null,
  actionType: "seo.synopsis_rewrite",
  targetType: "media",
  targetId: "m1",
  targetLabel: "Le Film",
  rationale: "mot-clé absent",
  payload: { synopsisFr: "Nouveau synopsis", query: "le film age" },
  previous: { synopsisFr: "Ancien synopsis" },
}

function level(l: string | null, minConfidence: number | null = null) {
  db.agentAutonomy.findUnique.mockResolvedValue(l ? ({ actionType: "x", level: l, minConfidence } as never) : null)
}

const p2002 = () => new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "5.22.0" })

beforeEach(() => {
  vi.clearAllMocks()
  db.agentAction.create.mockResolvedValue({ id: "a1" } as never)
  db.mediaItem.updateMany.mockResolvedValue({ count: 1 } as never)
  db.mediaItem.findUnique.mockResolvedValue({ id: "m1" } as never)
  db.agentAction.updateMany.mockResolvedValue({ count: 1 } as never)
  db.agentAction.update.mockResolvedValue({} as never)
})

describe("proposeAgentAction", () => {
  it("at « Proposer », queues and never touches the catalogue", async () => {
    level("suggest")
    const r = await proposeAgentAction(proposal)
    expect(r.outcome).toBe("queued")
    expect(db.mediaItem.updateMany).not.toHaveBeenCalled()
    expect(db.agentAction.create.mock.calls[0][0].data).toMatchObject({ status: "pending", autonomy: "suggest" })
  })

  it("fails CLOSED: a proposal that can't be queued is dropped, not applied", async () => {
    level("suggest")
    db.agentAction.create.mockRejectedValue(new Error("relation agent_actions does not exist"))
    const r = await proposeAgentAction(proposal)
    expect(r.outcome).toBe("dropped")
    expect(db.mediaItem.updateMany).not.toHaveBeenCalled()
  })

  it("reports an already-open proposal instead of stacking a second one", async () => {
    level("suggest")
    db.agentAction.create.mockRejectedValue(p2002())
    expect((await proposeAgentAction(proposal)).outcome).toBe("already_pending")
  })

  it("in observation mode, records without writing", async () => {
    level("shadow")
    const r = await proposeAgentAction(proposal)
    expect(r.outcome).toBe("shadowed")
    expect(db.mediaItem.updateMany).not.toHaveBeenCalled()
  })

  it("at « Agir et signaler », writes compare-and-set and lists it for review", async () => {
    level("act_report")
    const r = await proposeAgentAction(proposal)
    expect(r.outcome).toBe("applied")
    expect(db.mediaItem.updateMany).toHaveBeenCalledWith({
      where: { id: "m1", synopsisFr: "Ancien synopsis" },
      data: { synopsisFr: "Nouveau synopsis", synopsisFrCheckedAt: null },
    })
    expect(db.agentAction.create.mock.calls[0][0].data).toMatchObject({ status: "applied", needsReview: true })
  })

  it("autonomous writes are logged without asking for review", async () => {
    level("autonomous")
    await proposeAgentAction(proposal)
    expect(db.agentAction.create.mock.calls[0][0].data).toMatchObject({ status: "applied", needsReview: false })
  })

  it("keeps writing like before the migration when the policy table is missing (registry default)", async () => {
    db.agentAutonomy.findUnique.mockRejectedValue(new Error("no table"))
    db.agentAction.create.mockRejectedValue(new Error("no table"))
    const r = await proposeAgentAction(proposal)
    // seo.synopsis_rewrite defaults to act_report: the agent's historical behaviour.
    expect(r.outcome).toBe("applied")
    expect(db.mediaItem.updateMany).toHaveBeenCalled()
  })

  it("a confidence floor routes an unsure action to the queue even at « Autonome »", async () => {
    level("autonomous", 0.9)
    const r = await proposeAgentAction({ ...proposal, confidence: 0.6 })
    expect(r.outcome).toBe("queued")
    expect(db.mediaItem.updateMany).not.toHaveBeenCalled()
  })

  it("never overwrites a field that changed since the agent read it", async () => {
    level("act_report")
    db.mediaItem.updateMany.mockResolvedValue({ count: 0 } as never)
    const r = await proposeAgentAction(proposal)
    expect(r.outcome).toBe("failed")
    expect(r.error).toMatch(/modifiée/)
    expect(db.agentAction.create.mock.calls[0][0].data).toMatchObject({ status: "failed" })
  })

  it("refuses unregistered action types outright", async () => {
    const r = await proposeAgentAction({ ...proposal, actionType: "media.delete" })
    expect(r.outcome).toBe("dropped")
    expect(db.agentAction.create).not.toHaveBeenCalled()
  })

  it("counts proposals and applied writes on the run", async () => {
    db.agentRun.create.mockResolvedValue({ id: "r1" } as never)
    const run = await startAgentRun("seo-striking-distance")
    level("act_report")
    await proposeAgentAction({ ...proposal, run })
    level("suggest")
    await proposeAgentAction({ ...proposal, run })
    run.recordUsage("gpt-5-mini", { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 0 })
    expect(run.totals()).toMatchObject({ llmCalls: 1, actionsProposed: 2, actionsApplied: 1 })
    expect(db.agentAction.create.mock.calls[0][0].data).toMatchObject({ runId: "r1" })
  })
})

describe("decideAgentAction", () => {
  const pendingRow = {
    id: "a1",
    actionType: "seo.synopsis_rewrite",
    status: "pending",
    targetId: "m1",
    payload: proposal.payload,
    previous: proposal.previous,
  }

  it("approve claims the row before writing, then marks it applied", async () => {
    db.agentAction.findUnique.mockResolvedValue(pendingRow as never)
    const r = await decideAgentAction("a1", "approve", "admin1")
    expect(r.status).toBe("applied")
    expect(db.agentAction.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "a1", status: "pending" },
      data: { status: "approved", decision: "approved", decidedBy: "admin1" },
    })
    expect(db.mediaItem.updateMany).toHaveBeenCalled()
  })

  it("a second click on an already-decided action is a 409 and writes nothing", async () => {
    db.agentAction.findUnique.mockResolvedValue(pendingRow as never)
    db.agentAction.updateMany.mockResolvedValue({ count: 0 } as never)
    await expect(decideAgentAction("a1", "approve", "admin1")).rejects.toMatchObject({ status: 409 })
    expect(db.mediaItem.updateMany).not.toHaveBeenCalled()
  })

  it("an approval landing after a human edit fails with the reason and overwrites nothing", async () => {
    db.agentAction.findUnique.mockResolvedValue(pendingRow as never)
    db.mediaItem.updateMany.mockResolvedValue({ count: 0 } as never)
    await expect(decideAgentAction("a1", "approve", "admin1")).rejects.toMatchObject({ status: 409 })
    expect(db.agentAction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    )
  })

  it("revert restores the previous value only if the field still holds the agent's text", async () => {
    db.agentAction.findUnique.mockResolvedValue({ ...pendingRow, status: "applied" } as never)
    await decideAgentAction("a1", "revert", "admin1")
    expect(db.mediaItem.updateMany).toHaveBeenCalledWith({
      where: { id: "m1", synopsisFr: "Nouveau synopsis" },
      data: { synopsisFr: "Ancien synopsis", synopsisFrCheckedAt: null },
    })
  })

  it("a refused revert puts the row back to applied, so it can be retried", async () => {
    db.agentAction.findUnique.mockResolvedValue({ ...pendingRow, status: "applied" } as never)
    db.mediaItem.updateMany.mockResolvedValue({ count: 0 } as never)
    await expect(decideAgentAction("a1", "revert", "admin1")).rejects.toMatchObject({ status: 409 })
    expect(db.agentAction.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { status: "applied" } })
  })

  it("404s an unknown action", async () => {
    db.agentAction.findUnique.mockResolvedValue(null)
    await expect(decideAgentAction("nope", "reject", "admin1")).rejects.toMatchObject({ status: 404 })
  })
})
