# Totem Avisé — Agentic Transformation Analysis

> **Purpose.** A read-before-you-build briefing on turning Totem Avisé into a platform run predominantly by AI agents — blog, catalog, imports, marketing — grounded in the current state of the art (Anthropic tooling as of June 2026), with full cost, infrastructure, risk, and milestone detail.
>
> **Audience.** Xavier (founder/owner). **Status.** Analysis only — no code changed.
> **Date.** 2026-06-02.

---

## 0. TL;DR (read this first)

- **You are already ~60% of the way there.** The codebase runs **8+ semi-autonomous "soft agents"** today (news synthesis, two-pass enrichment, family-content editorial agent, cron supervisor with auto-remediation, moderation/quality/research judges, the Totem chatbot). They're direct Claude SDK calls on a cron schedule, not an orchestrated agent system — but the hard part (domain prompts, tool wiring, self-monitoring, email digests) is built.
- **The gap is orchestration + autonomy + the blog.** Today's "agents" are deterministic pipelines that *call* an LLM. A true agentic workflow lets the model **plan, choose tools, loop, and self-correct** toward an outcome, with humans approving at gates instead of triggering each step. The **blog is still 100% manual** (`.docx` → Sanity by hand) — that's the single biggest automation win available.
- **The state of the art is now buildable, not research.** Anthropic ships two production paths: the **Claude Agent SDK** (self-hosted agent loop with first-class subagents, sessions, context compaction) and **Claude Managed Agents** (cloud-hosted harness, beta, `managed-agents-2026-04-01` header) that bundles sessions + Skills + MCP + self-evaluation. Both reuse the harness behind Claude Code.
- **Cost is not the blocker.** Your *current* LLM spend is roughly **$50–80/month**. A fully agentic version (with the blog, marketing, and richer imports added) lands in the **~$120–300/month** range with batch + prompt-caching discipline — i.e. a rounding error against a single freelance content shift. The real budget item is **engineering time and the trust/guardrail work**, not tokens.
- **Recommended path:** keep your own infra, adopt the **Agent SDK incrementally** (orchestrator + 4 domain subagents), gate every outward-facing action (publish, post, spend) behind human approval at first, and graduate gates to autonomy domain-by-domain as confidence builds. Pilot **Managed Agents** for the marketing/social surface where hosted state + Skills earn their keep. **Do not rip out the working cron pipelines** — wrap them as tools the agents can call.

---

## 1. Where you are today

Totem Avisé is already an unusually automation-mature small product. The table below is the *real* inventory pulled from the codebase, not aspiration.

### 1.1 The pipelines that already run unattended

| Pipeline | Trigger | LLM | What it does | Autonomy level |
|---|---|---|---|---|
| **Catalog import** | Daily 3:00 (GH Actions) | none (TMDB/IGDB/CNC APIs) | Pulls ~10–20 new movies/TV/games/day, dedups | Fully automatic |
| **Enrichment Pass 1** | Daily 4:00 | OpenAI GPT-5-mini | Age rec, content metrics (0–5), topics, "what parents need to know" | Fully automatic |
| **Enrichment Pass 2 (deep)** | Daily 4:00 | OpenAI gpt-4o + web search | Re-verifies low-confidence items, French synopsis | Fully automatic |
| **Quality recompute** | Daily 4:00 | none | `dataQualityScore` across catalog | Fully automatic |
| **News discovery** | 4×/day (:17) | Claude **Sonnet 4.6** synth; **Haiku 4.5** moderate/judge/research | RSS → 1–3 synthesized briefs, moderated, quality-judged, linked to catalog | Auto-publish w/ quality gate (PENDING_REVIEW fallback) |
| **Weekly dossier** | Tue/Fri 5:00 | Claude Sonnet 4.6 | 800–1500-word long-read from the week's briefs | Auto w/ quality gate |
| **Family-content editorial agent** | Mon 6:00 | Claude Sonnet 4.6 | Scores recent media, emails *editorial priorities* + SEO/AEO angles to you | Advisory (emails human) |
| **Cron supervisor** | Daily 7:00 | none (orchestration) | Detects missing/stale/error/anomaly across 13 tasks, **auto-remediates up to 4**, emails digest | Self-healing |
| **Debt digest** | Wed 6:13 | none | Catalog/data-debt + editorial-queue tally email | Advisory |
| **SEO striking-distance** | Thu 6:23 | none (GSC API) | Pulls queries ranked 8–20, emails on-page nudges | Advisory |
| **Totem assistant** | On-demand | Haiku 4.5 default / Sonnet 4.6 escalation | Parent-facing chatbot w/ catalog tools, model-router | Interactive, tool-using |
| **Blog** | Manual | none | `.docx` drop → hand-published to Sanity | **0% automated** |

Stack: `@anthropic-ai/sdk` v0.90, **`@ai-sdk/anthropic` v3.0 + Vercel `ai` v6** (already installed — lowers Agent SDK adoption cost), `openai` v6.15, Next.js 16.2 / React 19.2, Prisma 5.22 on Supabase Postgres, Sanity CMS v5 for blog, Resend for email, Sentry + Vercel Analytics + Plausible (planned) for observability, GitHub Actions as the cron backbone (Vercel cron is one heartbeat watchdog). Tech health is self-assessed at **85/100** with mature ops/CI (15/15) — a strong base for autonomy.

> **Important context from the roadmap:** the product is in its **marketing/growth phase** (launch plan Phases A–F; A complete, B/C SEO+analytics planned, D marketing in progress). Two findings from the tech/product audits bear directly on an agent strategy and are treated as **prerequisites** in §6/§7: (1) **analytics blindness** — Plausible/GSC not yet live, so there's currently *no feedback signal* for agents to optimize against; (2) an **AI-transparency gap** — AI-generated age recs / metrics aren't labelled as such, a trust risk that compounds the moment agents author *more* public content.

### 1.2 What "agent" means here today vs. what you want

What you have is a **workflow-with-LLM-calls** architecture: a cron fires, code gathers inputs, calls Claude once (or in a fixed sequence), parses structured output, writes to the DB or sends an email. The *control flow is hard-coded*; the model fills in content.

What "fully run by agents" implies is a shift to **goal-directed loops**: you hand an agent an *outcome* ("keep the catalog enriched", "ship 2 blog posts/week on under-served topics", "improve rankings for striking-distance queries") plus **tools** and **guardrails**, and the model decides *which* steps to take, *in what order*, *how many times*, and *when it's done* — escalating to a human only at defined gates.

The good news: the migration is **additive**. Every pipeline above becomes a **tool** an orchestrator can call, so nothing is wasted.

---

## 2. State of the art — the Anthropic elements (June 2026)

Anthropic's agent stack has consolidated into a clean set of primitives. Here's what's relevant to you, and what each one buys.

### 2.1 Models & pricing (the cost basis for §5)

| Model | Input $/M tok | Output $/M tok | Use it for |
|---|---|---|---|
| **Claude Opus 4.7** (flagship) | $5.00 | $25.00 | Hard reasoning, the orchestrator's tough calls, blog drafting when quality matters most |
| **Claude Sonnet 4.6** | $3.00 | $15.00 | Workhorse synthesis — blog drafts, dossiers, marketing copy (already your synth model) |
| **Claude Haiku 4.5** | $1.00 | $5.00 | High-volume cheap judgment — moderation, classification, routing, simple tool steps |

- **Batch API: −50%** on everything. Most of your work (enrich, nightly blog drafts, marketing copy) is *not* latency-sensitive → batch it.
- **Prompt caching: −90%** on cached input tokens. Your big stable system prompts (editorial rules, brand voice, French style guide, age-rating rubric) are *identical every call* → cache them. This is the single highest-leverage cost lever for an agent system that reuses long instructions.
- Output is 5× input across the board — agent loops that ramble are what cost money, hence the budget caps in §6.

> Note: this analysis runs on **Opus 4.8** internally; public API pricing pages currently list **Opus 4.7** as flagship at the rates above. Budget against published rates and treat 4.8 as a drop-in at parity or near-parity.

### 2.2 Claude Agent SDK — the self-hosted path

The Agent SDK (Python + TypeScript) is the same agent loop, tool harness, and context management that powers Claude Code, exposed as a library you run on your own infra. Key primitives:

- **The agent loop**: model plans → calls tools → observes results → loops until the goal is met. You define tools; it decides usage.
- **Subagents (first-class)**: a lead/orchestrator agent delegates focused subtasks to specialist subagents, each with its **own isolated context window, model, prompt, and tools**, running **in parallel** on a shared filesystem. Subagents return only a *summary* to the orchestrator — so a "research the topic across 20 RSS feeds" subagent doesn't pollute the orchestrator's context. This maps perfectly onto your four domains (catalog / blog / marketing / ops).
- **Sessions**: resumable conversation state — pause and pick up hours later, or restart a crashed task from the last persisted turn.
- **Context compaction**: automatic summarization at a threshold (60–80% context reduction reported) so long-running agents don't blow the window.
- **Billing change to note:** from **June 15, 2026**, Agent SDK / `claude -p` usage on *subscription* plans draws from a separate monthly Agent SDK credit pool. For a production app you'll be on **API/usage billing**, so this mainly matters if you prototype on a Claude subscription.

### 2.3 Claude Managed Agents — the hosted path (beta)

A suite of composable APIs for **cloud-hosted** agents (beta header `managed-agents-2026-04-01`). You persist an **Agent config** (model, system prompt, tools, up to 20 MCP servers, up to 20 Skills), then start **Sessions** that reference it.

- **Stateful by design**: sessions are long-running, resume after pauses, store conversation history + sandbox state + outputs **server-side** (Anthropic hosts the state you'd otherwise build in Postgres/Redis).
- **Outcome-driven**: you define success criteria; Claude **self-evaluates and iterates** until it meets them.
- **Skills**: packaged capabilities (incl. pre-built `xlsx`/`docx`/`pptx`/`pdf`) auto-invoked when relevant — directly useful for your `.docx → blog` workflow.
- **MCP connector**: declare external tool servers by name/URL; session supplies auth from a registered vault.
- **Tradeoff**: less infra to run, faster to production, but you give up some control and run inside Anthropic's harness/sandbox. Best for surfaces where hosted state + Skills are the value (marketing/social, document-driven blog ingestion).

### 2.4 Skills & MCP — the connective tissue

- **MCP (Model Context Protocol)** is how agents reach your tools/data uniformly. You'd expose Totem's capabilities — *search catalog, enrich item, query GSC, publish to Sanity, send email, post to social* — as MCP tools (or plain SDK tools), and any agent (SDK or Managed) can use them. This is also exactly how *this* Claude Code session reaches GitHub.
- **Skills** are reusable, model-invoked capability packages (instructions + optional code). Your "brand voice", "French CSA/PEGI rubric", "blog SEO checklist" become Skills the agents auto-apply — versioned in the repo, not copy-pasted into prompts.

### 2.5 Build-vs-buy summary

| Option | You run | Best for | Watch out for |
|---|---|---|---|
| **Keep direct-SDK pipelines** (today) | Everything | Deterministic, well-understood jobs (import, quality recompute) | Not goal-directed; can't adapt |
| **Agent SDK (self-host)** | Orchestrator + subagents on your infra (Vercel/GH Actions/worker) | Catalog, ops, blog — where you want control + repo-versioned tools | You build state, cost caps, circuit breakers |
| **Managed Agents (hosted)** | Config only; Anthropic hosts state/sandbox | Marketing/social, document-driven blog, fast pilots | Beta; less control; data leaves your DB into the sandbox |

**Recommendation:** Agent SDK as the backbone (it composes with your existing tools and repo), Managed Agents as a *targeted pilot* on marketing. Don't pick one religiously — they share MCP/Skills, so tools you build are portable.

---

## 3. Target architecture — Totem as an agent system

The cleanest design is **one orchestrator + four domain subagents + a human-gate layer**, all sharing a common tool/Skill library over MCP. Keep the existing cron pipelines as **callable tools**, not as the brain.

```
                 ┌─────────────────────────────────────────┐
                 │        ORCHESTRATOR (Sonnet/Opus)         │
                 │  - reads goals + daily state              │
                 │  - plans, delegates, enforces budgets     │
                 │  - routes approvals to human gates        │
                 └───────┬───────────┬───────────┬──────────┘
        ┌────────────────┘           │           └────────────────┐
        ▼                ▼           ▼                            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐      ┌──────────────┐
│  CATALOG     │ │  EDITORIAL/   │ │  MARKETING/  │      │  OPS /        │
│  AGENT       │ │  BLOG AGENT   │ │  GROWTH AGENT│      │  SUPERVISOR   │
│ (Haiku/Sonn) │ │ (Sonnet/Opus) │ │ (Sonnet)     │      │ (Haiku)       │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘      └──────┬───────┘
       │                │                │                     │
       ▼                ▼                ▼                     ▼
   TOOLS over MCP:  import • enrich • quality • search-catalog •
   draft-blog • publish-sanity • query-GSC • keyword-research •
   draft-social • send-email • read-cron-logs • file-issue
       │
       ▼
   ┌─────────────────────── HUMAN GATES ───────────────────────┐
   │ publish blog · post social · spend ad budget · schema edit │
   │ (start: all gated → graduate to auto per domain)           │
   └────────────────────────────────────────────────────────────┘
```

### 3.1 Catalog Agent (imports + enrichment)
- **Goal:** "Catalog is fresh, complete, and high-quality; minimize unenriched / no-poster / no-age-rec / low-quality items (manga excluded)."
- **Tools:** existing import endpoints, `enrich`, `enrich-deep`, `quality/compute`, `similarity/compute`, `backfill-ratings`, plus a *read* tool over the debt-digest metrics.
- **Why agentic helps:** today the batch sizes are fixed (10/day). An agent reads the backlog, *decides* how aggressively to enrich, *prioritizes* high-traffic or soon-trending titles (cross-referencing GSC + now-playing), and *retries intelligently* on low-confidence items instead of a blind fixed loop.
- **Autonomy:** safe to run near-autonomous early — it only writes catalog metadata, already quality-gated. **Schema changes stay human-gated** (your `topics` table conflict / raw-SQL migration rule).

### 3.2 Editorial / Blog Agent (the biggest win)
- **Goal:** "Ship N posts/week on under-served, high-intent topics aligned to the editorial calendar; keep brand voice and French style; full SEO/JSON-LD."
- **Tools:** `keyword-research`/GSC striking-distance, `search-catalog` (to ground posts in real fiches), an internal `draft-blog` (Sonnet/Opus), image selection, and **`publish-sanity`** (write via `SANITY_API_WRITE_TOKEN`, the same path a human uses). The pre-built **`docx` Skill** lets it also ingest your `.docx` drops automatically.
- **Workflow:** topic discovery (from GSC gaps + content calendar + news clusters) → outline → draft → self-critique against an editorial Skill (voice, length, no tool/service leaks per CLAUDE.md) → SEO pass (title/excerpt/seoTitle/seoDescription/JSON-LD) → **stage as Sanity draft** → human approve → publish.
- **Autonomy:** **gated at publish** for the first ~20 posts, then auto-publish for low-risk evergreen categories ("Guides pratiques") while keeping "Actualités"/sensitive topics gated.

### 3.3 Marketing / Growth Agent
- **Goal:** "Grow qualified organic traffic and newsletter signups; surface and act on the highest-leverage growth moves weekly" — in service of the existing **Phase D (social/marketing launch)** and **Phase E (growth features)** of the launch plan.
- **Tools:** GSC + the striking-distance report (already built), social drafting, newsletter drafting (Brevo/Resend audience), Plausible read (once live), and a `propose-experiment` tool that logs ideas for human approval.
- **Channels it drafts for (from the marketing playbook):**
  - **Instagram @totemavise** — carousels (poster + age badge → 7-criteria breakdown → verdict), 3–4/wk + stories.
  - **TikTok @totemavise** — "À partir de quel âge ?" poster-reveal format, 2–3/wk.
  - **Facebook / X** — full reviews, "Ce week-end on regarde", quick takes.
  - **Newsletter** — bi-weekly new-reviews + recommendations (via Brevo, CNIL-friendly).
- **SEO focus (its primary leverage):** the playbook's priority long-tail keywords — *"film pour enfant [âge]"*, *"avis [titre] enfant"*, *"à partir de quel âge [film]"*, *"jeu vidéo enfant [âge]"*, *"série netflix enfant"*. The agent's highest-value loop is: GSC gap → ground in a real fiche → on-page nudge or new collection/age page → JSON-LD/OG check. This dovetails with the **Blog Agent** (§3.2) — they share the keyword-research tool.
- **Outreach targets to surface (not auto-contact):** CLEMI (.gouv backlink), Numerama / FrAndroid / Journal du Geek, Maddyness, Product Hunt, parent forums (Doctissimo, MagicMaman). The agent drafts pitches; **you send them**.
- **Autonomy:** **everything that publishes externally is human-gated initially** (brand risk is highest here, and the brand voice is "warm, never corporate"). Good candidate for the **Managed Agents pilot** — hosted state + Skills + the `pptx/docx` skills for asset generation.
- **Constraints to honor (hard rules in the marketing Skill + automated self-check):** (1) CLAUDE.md forbids exposing third-party service names (TMDB/IGDB/OpenAI/Claude) in user-facing text; (2) respect the **AI-transparency** requirement — any agent-authored public content that cites age recs/metrics must carry the "estimation basée sur l'analyse du contenu" framing; (3) hold the brand tone (expert-but-warm, French-first).

### 3.4 Ops / Supervisor Agent
- **Goal:** "All pipelines healthy; debt trending down; escalate only what needs a human."
- **This already exists** (`cron-supervisor.ts` + `debt-digest.ts`). Upgrade it from *deterministic detector* to an *agent* that can read logs, **diagnose root cause**, choose among a wider remediation menu (with the existing 3–4-action safety cap), open a GitHub issue with a proposed fix, and write a plain-French incident note. Keep `CRON_SUPERVISOR_REMEDIATE` kill-switch.

### 3.5 The human-gate layer (non-negotiable at the start)
Every **irreversible or outward-facing** action — publish blog, post social, send newsletter, spend ad budget, edit schema, delete data — goes through an approval gate. Practically: the agent stages the artifact (Sanity draft, queued email, GitHub PR) and pings you (email/Slack/Telegram) with a one-click approve. Gates **graduate to autonomy per-domain** as each proves itself over a defined number of clean runs. This is the difference between "agents help me" and "agents embarrass me at 3am."

---

## 4. Infrastructure

You don't need a platform migration. Three viable hosting shapes, in order of recommended adoption:

1. **GitHub Actions as the agent runner (start here).** You already use it as the cron backbone. An agent run is just a longer job: `node`/`tsx` process boots the Agent SDK orchestrator, runs the loop, exits. Pros: free-ish, already wired with `CRON_SECRET`/secrets in the `Production` environment, easy logs. Cons: 6h max job, no always-on. Fine for scheduled agent runs (nightly blog, weekly marketing, daily catalog).
2. **A small always-on worker (graduate here).** When you want *event-driven* agents (e.g., react to a new high-traffic GSC query, or a Sanity webhook), add a tiny worker — a Vercel cron-triggered function chain, a Railway/Fly worker, or a Supabase Edge Function. Durable state lives in **Postgres** (you already have it): an `agent_runs` table (mirror of `cron_logs`), an `agent_artifacts`/approval-queue table, and a `agent_budgets` table.
3. **Managed Agents for the hosted surface.** No runner to manage — Anthropic holds session state. Use for the marketing pilot and/or document-driven blog ingestion.

**Cross-cutting infra to add:**
- **State & audit:** extend the `cron_logs` pattern into `agent_runs` (goal, plan, tool calls, tokens, cost, outcome) — you already have the logging muscle (`logCronRun`). This is your observability + cost ledger.
- **Approval queue:** a DB table + a section in `/admin/operations` ("À valider") where staged artifacts wait. Reuse the admin dashboard you already have.
- **Tool layer (MCP):** wrap existing endpoints as MCP/SDK tools with strict input schemas and per-tool permissions. Tools are the security boundary — an agent can only do what its tools allow.
- **Secrets:** agents need scoped keys. Keep `CRON_SECRET` for internal endpoints; add a dedicated `ANTHROPIC_API_KEY` budget/project for agents so you can cap and attribute spend.
- **Kill switches:** per-agent enable flags (you already do this with `CRON_SUPERVISOR_REMEDIATE`, `TOTEM_PUBLIC`, `NEWSLETTER_PUBLIC` — follow the same pattern).

---

## 5. Cost analysis

### 5.1 Where you are now
From CLAUDE.md + the inventory: enrichment ~$0.35–0.90/week; news synthesis on Sonnet 4×/day; judges on Haiku (negligible); family-content agent ~$1/month. **Current all-in LLM spend ≈ $50–80/month** (dominated by Sonnet news synthesis + OpenAI enrichment).

### 5.2 Estimated agentic-era spend
Assumptions: prompt-caching on all stable system prompts (−90% on cached input), batch API for non-urgent work (−50%), Haiku for routing/judging, Sonnet for synthesis, Opus only for hard calls. Token estimates are deliberately conservative (rounded up).

| Workload | Volume | Model mix | Est. monthly cost |
|---|---|---|---|
| **Catalog agent** (import + enrich orchestration) | ~210 enrich items/wk + planning | Haiku plan + existing enrich | **$10–20** |
| **Blog agent** | ~8–12 posts/mo, research + draft + critique + SEO (~60–120k tok each w/ research) | Sonnet draft, Haiku research, occasional Opus | **$25–60** |
| **Marketing agent** | weekly review + asset drafts + social | Sonnet | **$15–35** |
| **Ops/supervisor agent** | daily diagnosis | Haiku | **$3–8** |
| **Orchestrator overhead** | daily planning + delegation | Sonnet, cached prompts | **$10–25** |
| **Totem chatbot** (if opened to public) | usage-driven | Haiku/Sonnet | **$10–60** (scales w/ traffic) |
| **Enrichment (existing OpenAI)** | unchanged or migrated to Claude | GPT-5-mini/gpt-4o or Haiku | **$5–15** |
| **Contingency / loops / retries** | — | — | **$20–40** |
| **TOTAL** | | | **≈ $120–300 / month** |

**Sensitivity:** without caching + batch discipline this can **2–3×** (Opus loops are the danger). With strict caps and Haiku-first routing it trends to the low end. The dominant variables are (1) blog volume, (2) whether the Totem chatbot goes public, (3) caching hit rate.

### 5.3 Cost-control levers (apply from day 1)
- **Per-task / per-day hard caps** in the harness (e.g., `max_tool_calls = 12`, kill at 2× budgeted cost). Caps belong in the agent, not in a monthly billing alert.
- **Prompt caching** for every long stable instruction set (editorial rules, rubrics, brand voice) — biggest single saver.
- **Batch API** for nightly/weekly non-urgent work.
- **Model routing** (you already do this in the Totem model-router): Haiku by default, escalate to Sonnet/Opus only on signal.
- **Progress-based termination**: kill loops that call the same tool twice in a row with no progress.
- **The real cost is engineering + trust-building, not tokens.** Even the high estimate ($300/mo) is far below one freelance content day. Budget your *attention* for the guardrail/review work in months 1–3.

---

## 6. Risks & guardrails

| Risk | Mitigation |
|---|---|
| **Brand/quality damage from auto-published content** | Human gates on all publish/post/send until N clean runs; self-critique step against editorial Skill; staged drafts only |
| **Hallucinated facts in blog/marketing** | Ground every claim in catalog data or cited sources (you already do this in news-research); require citations; quality-judge before staging |
| **Runaway token spend** | Per-task cost caps + circuit breakers + batch + caching (§5.3); dedicated capped API project |
| **Leaking internal services** (TMDB/IGDB/OpenAI/Claude) into user-facing text | Hard rule in the marketing/blog Skill + an automated post-draft scan (you already enforce this manually) |
| **Schema/data corruption** | Schema edits **never** agent-autonomous (respect the `topics`/raw-SQL migration rule); destructive ops human-only |
| **Silent failure** (the failure mode that "evades local testing") | Extend supervisor to watch agent runs; heartbeat/watchdog like today's Vercel cron; alert on zero-output runs |
| **Prompt injection via RSS / external content** | Treat all fetched content as untrusted; never let it trigger tools directly; moderation step (you have this) |
| **Over-automation / loss of editorial voice** | Keep a human editor-in-chief role; agents propose, you curate; periodic human review of auto-published output |
| **Optimizing blind (no feedback signal)** | **Prerequisite:** wire Plausible + GSC *before* the marketing/growth agent — agents can't improve rankings/engagement they can't measure. Give the agents read access to those metrics |
| **AI-transparency trust collapse** | Label agent-authored public content + AI age recs ("estimation basée sur l'analyse du contenu"); the more agents publish, the more this matters. Make it a hard rule in the editorial/marketing Skills |
| **Vendor/beta risk** (Managed Agents beta, model deprecations) | Keep tools portable over MCP; pin model IDs; the `deepseek.ts`-style "dormant client" pattern shows you already manage provider churn well |

---

## 7. Milestones & roadmap

Phased so each phase ships value and de-risks the next. Gate everything outward-facing; graduate gates as trust accrues.

> **Prerequisite (do alongside Phase 0, not after):** finish launch **Phase B/C** — JSON-LD + OG metadata and **Plausible + Google Search Console**. This is cheap (~$9/mo, a few hours) and is the *feedback signal* the marketing/blog agents optimize against. Also ship the **AI-transparency labels** before agents author more public content. An agent system without measurement just generates faster; it doesn't get better.

### Phase 0 — Foundations (1–2 weeks)
- Stand up the **Agent SDK** in a GH Actions job (hello-world orchestrator). You already have `@ai-sdk/anthropic` + Vercel `ai` installed, so the streaming/tool-call plumbing is partly in place.
- Build the **tool/MCP layer**: wrap existing endpoints (import, enrich, search-catalog, GSC, send-email) as typed tools.
- Add `agent_runs` table + cost ledger (extend `logCronRun`) and an **approval queue** table + `/admin/operations` "À valider" panel.
- Author the first **Skills**: brand voice, French style, CSA/PEGI rubric, "no service leaks" rule.
- **Exit criteria:** an orchestrator can call ≥3 tools, log cost, and stage an artifact for approval.

### Phase 1 — Blog Agent (2–4 weeks) — *highest ROI*
- Topic discovery from GSC gaps + content calendar; draft → self-critique → SEO → **Sanity draft** → human approve.
- Wire the **`docx` Skill** so `.docx` drops are ingested automatically.
- **Gate:** all posts human-approved. **Target:** 4–8 staged drafts/week, you approve in minutes.
- **Exit criteria:** 10 posts shipped via the agent with light human editing; voice consistent.

### Phase 2 — Catalog Agent (2–3 weeks)
- Promote the enrichment/import crons into an agent that prioritizes by traffic/trending and retries low-confidence items intelligently.
- **Gate:** metadata writes auto (already quality-gated); schema edits human-only.
- **Exit criteria:** backlog metrics (unenriched/no-poster/no-age-rec) trend down week-over-week vs. the fixed-batch baseline.

### Phase 3 — Marketing/Growth Agent + Managed Agents pilot (3–4 weeks)
- Weekly growth review → ranked backlog → drafted assets (social, newsletter, on-page nudges).
- Pilot **Managed Agents** for this surface (hosted state + Skills).
- **Gate:** every external publish human-approved; no ad spend without explicit per-campaign approval.
- **Exit criteria:** consistent weekly growth backlog + assets; measurable lift in ≥1 striking-distance cohort.

### Phase 4 — Ops Agent upgrade + graduated autonomy (2–3 weeks)
- Upgrade supervisor from detector to diagnosing agent (root cause, GitHub issue with proposed fix, wider remediation menu under the safety cap).
- **Graduate gates:** auto-publish low-risk evergreen blog categories; auto-post pre-approved social templates. Keep sensitive/"Actualités" gated.
- **Exit criteria:** ≥1 domain running autonomously for 30 days with zero incidents.

### Phase 5 — Orchestration & steady state (ongoing)
- Single daily orchestrator run that reads goals + state, delegates to all four subagents in parallel, and produces one digest.
- Quarterly review of gates, costs, model choices, and Skills.
- **Steady state:** you operate as **editor-in-chief + approver**, not operator. Agents do; you decide.

### Suggested sequencing rationale
Blog first (manual today → biggest unlock, lowest data-risk), then catalog (high value, already gated by quality), then marketing (highest brand-risk, do it once gates + Skills are proven), then ops + graduation last (autonomy is earned).

---

## 8. Open questions — with recommended answers

These were the decisions to settle before dev mode. Below each is a **recommended default**, reasoned from where Totem Avisé actually is: a solo-operated, growth-phase product whose moat is *trust + French-first SEO*, handling *CNIL-sensitive family/child data*, on a near-zero infra budget. Treat them as starting positions to confirm or override.

### Q1 — Blog cadence & autonomy ceiling
**Recommendation: 2–3 posts/week. Start fully gated. Graduate only evergreen guides to auto-publish; keep anything sensitive or topical permanently gated.**
- *Why this cadence:* SEO is your primary growth lever and organic takes 3–6 months — you need consistent velocity, but you're cold-starting and your brand voice ("warm, never corporate") is fragile. 2–3/week compounds without flooding. Tie each post to a real fiche + a priority keyword (*"film pour enfant [âge]"*, *"à partir de quel âge [film]"*) so every post does SEO double-duty.
- *Autonomy ceiling:* the categories split cleanly by risk. **May eventually auto-publish (after ~20 clean gated runs):** "Guides pratiques" and age-based evergreen guides — low factual volatility, high SEO value. **Keep permanently human-gated:** "Actualités", and "Parentalité numérique" when it touches hard subjects (the editorial pipeline already tags tone `grave`/`concerning` — reuse that signal to force a gate). Never let an agent auto-publish a post whose claims aren't grounded in a catalog fiche or a cited source.

### Q2 — Marketing scope
**Recommendation: organic/SEO + newsletter only for now. No agent-controlled ad spend. Revisit paid once Plausible proves a converting funnel.**
- *Why:* your launch budget is ~$11/mo and you have no analytics yet — buying traffic before you can measure conversion is spending blind. Your cheapest, highest-leverage channel is the GSC striking-distance loop you've *already built*; the marketing agent should exploit that plus newsletter (Brevo) and drafted social, all gated. Defer Google Ads (the Phase-4 "[titre] avis enfant" idea) until you can see signup/return rates. When you do enable paid, it stays **human-approved per campaign with a hard budget** — never an autonomous spend tool.

### Q3 — Hosting
**Recommendation: self-host the Agent SDK on your existing GitHub Actions backbone. Pilot Managed Agents *only* for marketing-asset generation that touches no personal data.**
- *Why:* you handle family profiles and children's data under CNIL/GDPR, and your ops/CI is already mature (15/15). Keeping the catalog, blog, and ops agents on your own infra means user data never leaves your Postgres. Managed Agents' hosted sandbox is genuinely useful for *non-PII* work — drafting carousels, press kits, social copy with the `docx`/`pptx` Skills — so scope the pilot there. Because both share MCP/Skills, tools you build stay portable if you later move a workload either direction.

### Q4 — Provider consolidation
**Recommendation: consolidate onto Claude, but as a *Phase-2 optimization*, not a day-1 blocker — and A/B the enrichment quality first.**
- *Why:* you already moved the news pipeline to single-provider Claude precisely because the multi-provider cascade caused silent failures — same logic favors consolidating enrichment (operational simplicity, one bill, one set of guardrails, prompt-caching across all agents). The one thing to protect is **Pass-2 deep enrichment's web-search** step (currently gpt-4o); validate Claude's equivalent matches quality on a sample before cutting over. Until then, leave enrichment as-is so the migration never blocks the agentic rollout.

### Q5 — Approval channel
**Recommendation: start with email (Resend — already wired). Add Telegram for one-tap mobile approvals in Phase 3 when volume makes email tedious.**
- *Why:* you're solo and every digest in the system already flows through Resend, so email approvals are zero new infra — the agent stages a Sanity draft / queued asset and emails you an approve link. Once the blog + marketing agents are producing several artifacts a day, batch-approving from your phone via Telegram beats inbox triage. Don't add Slack (no team to justify it).

### Q6 — Budget ceiling
**Recommendation: hard cap **$200/mo**, target **~$150**. Per-agent sub-caps; Haiku-first routing; batch + prompt-caching mandatory.**
- *Why:* the modelled agentic range is $120–300/mo; for a solo growth-stage product, $300 is a ceiling you shouldn't *need* to hit. Set the harness hard-cap at **$200** with sub-caps (e.g. blog $60, marketing $35, catalog $25, ops $10, orchestrator $25, buffer $45) and let the chatbot scale separately with traffic. Route Haiku by default, escalate to Sonnet/Opus only on signal, cache the long stable prompts, and batch everything non-urgent — that keeps the realistic run-rate near $150 and leaves headroom before the cap ever trips.

### One-line summary of the recommended posture
Self-hosted Agent SDK · blog 2–3×/wk starting fully gated · organic-only marketing (no agent ad spend) · email approvals → Telegram later · consolidate to Claude in Phase 2 · **$200/mo hard cap (~$150 target)**. Conservative on autonomy and spend, aggressive on SEO leverage — matching a trust-led, growth-phase, solo product.

### Original questions (for reference)
1. **Blog cadence & autonomy ceiling** — how many posts/week, and which categories (if any) may *ever* auto-publish?
2. **Marketing scope** — organic/SEO + newsletter only, or also paid?
3. **Hosting** — self-hosted Agent SDK, or pilot Managed Agents?
4. **Provider** — consolidate enrichment onto Claude, or keep dual-provider?
5. **Approval channel** — email, or add Slack/Telegram?
6. **Budget ceiling** — confirm a hard monthly cap.

---

## 9. Bottom line

Totem Avisé is a rare case where "make it agentic" is **evolution, not rewrite**. You have the pipelines, the self-monitoring, the model wiring, and the admin surface. The work is: (1) put an **Agent SDK orchestrator + 4 subagents** on top of your existing tools, (2) **automate the blog** (the one fully-manual gap), (3) wrap everything in **human gates + cost caps**, and (4) **graduate autonomy domain-by-domain**. Token cost is trivial relative to the value; the disciplined part is guardrails and trust-building. Start with the blog agent — it's the clearest win and the safest place to learn the pattern.

---

### Sources (state-of-the-art research, June 2026)
- [Agent SDK overview — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/overview)
- [Building agents with the Claude Agent SDK — Anthropic](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Managed Agents overview — Claude API Docs](https://platform.claude.com/docs/en/managed-agents/overview)
- [Skills — Claude API Docs](https://platform.claude.com/docs/en/managed-agents/skills)
- [MCP connector — Claude API Docs](https://platform.claude.com/docs/en/managed-agents/mcp-connector)
- [Anthropic updates Claude Managed Agents with three new features — 9to5Mac](https://9to5mac.com/2026/05/07/anthropic-updates-claude-managed-agents-with-three-new-features/)
- [Claude API Pricing — Claude API Docs](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude API Pricing 2026 — CloudZero](https://www.cloudzero.com/blog/claude-api-pricing/)
- [Claude Agent SDK: Complete Production Patterns Guide 2026 — Digital Applied](https://www.digitalapplied.com/blog/claude-agent-sdk-production-patterns-guide)
- [Claude Code subagents and the orchestrator pattern — Chanl](https://www.channel.tel/blog/claude-code-subagents-orchestrator-pattern)
- [AI Agent Token Budget Management — MindStudio](https://www.mindstudio.ai/blog/ai-agent-token-budget-management-claude-code)
- [Claude Agent SDK & Managed Agents: Anthropic's Q2 2026 Agent Infrastructure Play — Zylos Research](https://zylos.ai/research/2026-04-20-claude-agent-sdk-managed-agents-architecture/)
