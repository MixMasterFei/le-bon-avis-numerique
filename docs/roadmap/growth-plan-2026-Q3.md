# Growth Action Plan — Q3 2026 (post market study)

> Working checklist derived from `docs/marketing/market-study-2026-07.md` (11 Jul 2026).
> This file is the **execution** doc — the study is the reasoning. Tick items as done; update the dashboard weekly.

## The one thing driving all of this

**AI Overviews reach France between now and 23 September 2026.** Our own Search Console proves what happens: in Belgium & Switzerland (French AIO live since March 2025) our CTR runs **−55 to −85% vs France at equal positions**. Expected loss ≈ half the pure-SEO click yield within 24 months — right as traffic compounds (+35%/week × 6 weeks). So the strategy is fixed: **convert the SEO wave into registered families NOW, before the wave shrinks**, and shift value to what no answer box can serve (per-child fit, community, brand, embedded distribution).

Current baseline (11 Jul 2026): ~440 clicks/week, 12 real accounts, ~0.5% conversion, 0 brand demand, 4 age votes. The machine and demand are proven; the funnel is not built.

---

## Priorities (ranked by leverage)

### P1 — Build the fiche → signup funnel  ⭐ the single highest-leverage move
Everything else depends on this. 96% of clicks land on fiches; today they ask for nothing.
- [ ] Add the personalized hook at the age answer: *"Cet âge est une moyenne — voyez s'il convient à **votre** enfant."*
- [ ] Add the **save/favorite feature gate** (*"Gardez la liste de films de votre famille"*) — the #1 documented signup driver on content sites (16× a newsletter form).
- [ ] Keep it SEO-safe: full content indexed, gated features carry Google's `isAccessibleForFree` pattern (no cloaking, ~10 free pages/mo metering if ever hardened).
- [ ] Post-signup landing → Coin Famille.
- **Target:** fiche→signup 0.5% → **2%+ of clicks** within 90 days.

### P2 — Ship Coin Famille publicly
It's ready. Launch it as the **reason** to register, not a standalone.
- [ ] Flip `COIN_FAMILLE_PUBLIC` (registered users) once P1's signup ask is live on fiches.
- [ ] Instrument from day 1: WAU/MAU, M1→M6 member retention, members/account, reactions/week.
- **Target:** WAU/MAU ≥ 40% (family ritual is *weekly*, not daily); M6 member retention ≥ 30%.
- *Why it works structurally:* daily-refreshed content is the one mechanic that ~3×'s long-run retention (news D30 9–13% vs utility 3%), and it's the anti-answer-box layer.

### P3 — Prepare for AI Overviews (do NOT wait for it to land)
- [ ] One-line **quotable age verdict** high on every fiche (citation bait for AIO).
- [ ] Bulletproof structured data on every fiche (age, content axes, methodology link).
- [ ] Link the methodology page from every fiche (glass-box = citation credibility; the lane for "cited French family-media source" is vacant).
- [ ] **Monitor France vs BE/CH CTR monthly** from `dump/GoogleSearch/*/Countries.csv` — it's the best live AIO gauge in France. Re-export GSC monthly.

### P4 — Claim the games whitespace this quarter
"Fortnite quel âge" / "Roblox quel âge" have **no French authority** (PédaGoJeux is dead in search). Take the query class before AIO lands on it.
- [ ] Dedicated games-parents angle per popular title: PEGI + *pourquoi* + alternatives par âge.
- [ ] Ensure top games fiches carry a confident age + the quotable verdict (P3).

### P5 — Publish the 15 reviewed blog drafts (2/week)
An empty blog undermines the word "guide" and forfeits topical authority + AIO citation surface + the newsletter engine.
- [ ] Publish per the order in the blog-drafts review (2 fact-check gates: drafts 03 & 15).
- [ ] Wire each post's internal links to relevant fiches (maillage).

### P6 — Systematize the "L'Odyssée" pre-release play
The pre-release fiche is the moat AIO can't fill (corpus too thin to summarize). L'Odyssée earned 475 clicks *before* its release.
- [ ] Every 2026–2027 family release gets a fiche (provisional age, day-one) ranking **before** its première.
- [ ] Feed the release calendar into the enrichment pre-pass; SEO agent hand-optimizes the biggest titles.

### P7 — Open the BPI médiathèque door (first real B2B channel)
The only French B2B channel open to a solo operator: BPI "coopération numérique" catalog (took over Réseau Carel Jan 2025), free listing, transparent price grid required. Tickets ~€1–5K/yr/collectivité.
- [ ] Prepare a public price grid + a patron-facing "quel film/jeu pour quel âge" packaging.
- [ ] Contact BPI cooperation; target one pilot médiathèque (autumn budget season).
- *One pilot = a credibility anchor for press and future licensing.*

### P8 — Brand basics (the only AIO-proof demand — currently zero)
- [ ] Consistent "Totem Avisé" name in every snippet/OG title.
- [ ] Send the press pitch (`docs/marketing/pitch-press.md`).
- [ ] Track first non-zero brand-query trend in GSC.

---

## Weekly dashboard (track against these)

| Metric | Baseline (11 Jul) | 90-day target | Benchmark anchor |
|---|---|---|---|
| Weekly GSC clicks (FR) | ~440 | 1,500+ (watch AIO inflection) | own trend |
| France vs BE/CH CTR gap | −55–85% (proxy) | tracked monthly = AIO gauge | Ahrefs −58% |
| Fiche → signup conversion | ~0.5% | **≥ 2%** | 0.5–2%/mo typical, 3–6% niche-great |
| Registered families (non-admin) | 12 | 100+ | SensCritique ceiling ~20% of uniques |
| WAU/MAU of activated families | n/a | ≥ 40% | 40% good / 55% great |
| M6 member retention | n/a | ≥ 30% | 30% good / 50% great |
| Community votes/week (age+trigger) | < 2 | 25+ | flywheel start |
| Brand-query clicks/week | 0 | first non-zero trend | only AIO-proof demand |
| Newsletter/digest CTR (when live) | n/a | ≥ 3–4%/send | childcare = top email quartile |

---

## Monetization — deliberately NOT yet

Below ~50K visits/month, every hour on monetization is stolen from the funnel. The ~€5/month cost base makes patience free. When the time comes, in order:
1. **Médiathèques** via BPI (see P7).
2. **CSE** via aggregators (HelloCSE/Leeto/Club Employés) — the ToutApprendre playbook; cheap acquisition + white-label tier.
3. **Ratings-data licensing** — the asymmetric bet: **no one in France licenses per-title family-suitability data** (Sky×CSM 2019 proves the model). Pitch target: Plurimedia / Media Press (Télérama's metadata supplier).
4. **Supporter membership** ("Ami de Totem", ~€25/yr **annual-first**, never €2.99/mo — micro-pricing converts ½ as well, 7× lower LTV).
5. **Premium personalization tier** (~€39/yr) only after free personalization proves weekly retention.
- **Never:** display ads, affiliation, pay-for-rating — the independence promise *is* the licensing asset's value.

---

## Positioning statement (use verbatim in press / copy)

> **Totem Avisé est le guide familial qui répond avant tout le monde, pour votre enfant en particulier.** Films, séries et jeux — un âge conseillé argumenté dès l'annonce du titre, des critères publiés et vérifiables, affinés par les votes des familles, et des recommandations qui connaissent les sensibilités de *vos* enfants. Indépendant, sans publicité, gratuit.

One-liners per rival: vs filmspourenfants — *"trois médias, avant la sortie, pour votre enfant"* · vs les fermes SEO — *"une méthode publiée, pas une ferme à contenu"* · vs l'État — *"le jugement par titre que l'État ne fournit pas"* · vs AI Overviews — *"un âge moyen ne connaît pas votre enfant."*

---

*Reasoning, competitive map, SWOT, and fully-sourced research annexes: `docs/marketing/market-study-2026-07.md`.*
