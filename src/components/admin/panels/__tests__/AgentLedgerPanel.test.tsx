import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// next/font only works inside the Next compiler.
vi.mock("next/font/google", () => ({
  Fraunces: () => ({ className: "font-fraunces" }),
}))

import { AgentLedgerPanel } from "../AgentLedgerPanel"

const action = {
  id: "a1",
  agent: "seo-striking-distance",
  agentLabel: "Agent SEO",
  actionType: "seo.synopsis_rewrite",
  actionLabel: "Réécriture du synopsis (mot-clé de recherche)",
  fieldLabel: "Synopsis",
  status: "pending",
  autonomy: "suggest",
  needsReview: false,
  confidence: 0.92,
  targetType: "media",
  targetId: "m1",
  targetLabel: "Vaiana 2",
  targetHref: "/media/movie:m1",
  rationale: "Requête Google « vaiana 2 age » (position 11)",
  before: "Ancien synopsis",
  after: "Dès 6 ans, nouveau synopsis",
  error: null,
  decision: null,
  createdAt: "2026-11-05T10:00:00.000Z",
  decidedAt: null,
}

const overview = {
  available: true,
  pending: [action],
  toReview: [{ ...action, id: "a2", status: "applied", needsReview: true, targetLabel: "Zootopie 2" }],
  history: [],
  policies: [
    {
      actionType: "seo.synopsis_rewrite",
      actionLabel: action.actionLabel,
      agentLabel: "Agent SEO",
      level: "suggest",
      levelLabel: "Proposer",
      minConfidence: null,
      isDefault: false,
      trackRecord: { approved: 10, acknowledged: 0, rejected: 0, reverted: 0 },
      hint: "10 validations sans aucun refus : vous pouvez passer à « Agir et signaler ».",
    },
  ],
  costs: [
    { agent: "seo-striking-distance", agentLabel: "Agent SEO", runs: 4, llmCalls: 18, costUsd: 0.034, unpricedRuns: 0, actionsProposed: 9, actionsApplied: 7, lastRunAt: "2026-11-05T06:23:00.000Z" },
  ],
  totalCostUsd: 0.034,
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => (url === "/api/admin/agents" ? overview : { success: true }),
  }))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe("AgentLedgerPanel", () => {
  it("shows the queue, the review list, the policy hint and costs", async () => {
    render(<AgentLedgerPanel />)
    expect(await screen.findByText("Vaiana 2")).toBeInTheDocument()
    expect(screen.getByText("Zootopie 2")).toBeInTheDocument()
    expect(screen.getAllByText("Dès 6 ans, nouveau synopsis")).toHaveLength(2)
    expect(screen.getAllByText(/confiance 92 %/)).toHaveLength(2)
    expect(screen.getByText(/vous pouvez passer à « Agir et signaler »/)).toBeInTheDocument()
    expect(screen.getByText("Agent SEO", { selector: "td" })).toBeInTheDocument()
  })

  it("posts the decision for the clicked action", async () => {
    render(<AgentLedgerPanel />)
    fireEvent.click(await screen.findByRole("button", { name: /Appliquer/ }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/agents/actions/a1",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ decision: "approve" }) }),
      ),
    )
  })

  it("explains when the migration isn't applied yet", async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ ...overview, available: false, pending: [], toReview: [] }) }))
    render(<AgentLedgerPanel />)
    expect(await screen.findByText(/015_agent_ledger\.sql/)).toBeInTheDocument()
  })
})
