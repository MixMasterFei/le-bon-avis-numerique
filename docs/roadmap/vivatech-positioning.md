# Vivatech positioning — turning "it's AI" into the moat

**Status:** strategy / discussion (2026-06). Not started in code beyond Option A's
first step (the public "Pourquoi cet âge ?" rationale, shipped).
**Related:** [Plan B feasibility — Totem Score](./totem-model.md)

---

## The problem

When ChatGPT/Claude describe Totem Avisé, they hedge: *"be cautious, it's
AI-driven, not human-driven."* LLMs do this because *generic* AI content
hallucinates. The criticism wins by default because the thing that actually makes
Totem trustworthy — a **supervised** system, not a chatbot guessing — is invisible.

The goal: make that machinery visible and ownable, so the "it's AI" objection
becomes the **sales pitch**, especially ahead of **Vivatech 2027**.

## What the moat actually is

Not the AI. ChatGPT/Claude/Mistral are a *public oven* — anyone can rent the same
one. "We use AI" impresses no one. The moat is three things nobody else has:

1. **The data** — years of analyzed films/series/games + the signals families give
   (votes, reactions). ~10k enriched titles today.
2. **The "house style" (calibration)** — Totem's specific way of deciding the
   *recommended family age*, which can be stricter than the legal rating. This is
   the secret recipe, and it's gameable/copyable if exposed — so we expose results,
   never thresholds.
3. **The safety guardrails** — deterministic rules (`src/lib/age-floor.ts`) that
   stop a violent/mature title from ever landing at a kid-friendly age, even when
   the official rating is lenient.

Same oven, but our recipe and our pantry.

## Three options

### A. Trust layer / glass-box (cheapest, started)
Make the existing logic *visible*: a public "Pourquoi cet âge ?" explanation per
fiche (the content factors that drove the age, in plain language), plus a strong
"Notre méthode" story (independence from official ratings, deterministic
guardrails, consistency at scale, community calibration).
- **Moat-safe rule:** expose the *verdict and the reasoning*, never the *recipe*
  (thresholds, weights, discounts).
- **Shipped:** hover-tooltip rationale on the age badge + FAQ JSON-LD
  (`src/lib/age-rationale.ts`, `src/components/media/MediaHeroEditable.tsx`),
  strengthened `/notre-methode`.
- Bonus: it's also a GEO/AEO win — answer engines can cite *why*, not just the number.

### B. Proprietary model — "Totem Score" (the Vivatech artifact)
Build Totem's own age/safety scoring model, trained on owned data, so it's "*our*
model" rather than "we asked an AI." See [totem-model.md](./totem-model.md) for the
Phase 0/1 feasibility (corpus inventory, ground-truth strategy, golden set,
B-v1 vs B-v2). **B-v1 is buildable now** — it does not depend on community votes.

### C. Agentic content org (narrative glue)
Frame the existing cron/agent fleet (import, enrich, recalibrate, news, editorial)
as a *supervised autonomous editorial operation*, humans as governance. Good
"how we operate" wow; pairs with A or B.

## Sovereignty angle (French/European AI — e.g. Mistral)

Strong brand fit: a French family-safety brand running on French/European AI is a
story an American competitor can't tell. But stage it deliberately:

- **Separate the layers.** Enrichment processes *public film metadata* (weak GDPR
  case → mainly a brand + cost + French-quality decision). Anything touching
  **family/user data** (chatbot, personalization) is where EU data residency truly
  matters → prioritize sovereignty there.
- **Biggest synergy:** build **Plan B on an open-weight Mistral base, self-hosted
  or EU-hosted** → "our own family-safety model, French sovereignty, fully owned" —
  the Vivatech trifecta (owned + French + explainable).
- **Don't sovereignty-wash.** US cloud + "French AI" is a false claim; state only
  what's true (honesty is the brand).
- **Naming caution.** Publicly naming the base model can read as "just a wrapper";
  cleaner line is *"our own model, built in France/EU"* with the base as an internal
  detail — unless "Mistral inside" co-branding is a deliberate credibility choice.

## Anchor line

> "We're not an AI guessing about your kids. We're the audited safety layer that
> makes AI recommendations about kids trustworthy — in French, at scale, with the
> machine showing its work."

## Recommended next step

Build the **Plan B Step-2 eval harness** (read-only, no cost): measures current
rating accuracy vs the official answer key **and** doubles as a **GPT-vs-Mistral
A/B on Totem's own data**. One tool answers both "how good are we?" and "does
French AI match/beat it?" — real numbers before committing to either Plan B or a
provider switch.
