# Totem Avisé — Deep Market Study (July 2026)

*Prepared 2026-07-11. Sources: proprietary Search Console exports (`dump/GoogleSearch/`, three 3-month windows: exports of June 13, June 19, July 10), production database queries (same day), and four commissioned research sweeps (French competitive landscape, international models, market/regulatory/AI-search, growth & monetization) — all web claims carry their source URL. Supersedes parts of `market-analysis.md`; complements `claude_mkt.md` and `pitch-press.md`.*

---

## 1. Executive summary

**Position in one paragraph.** Totem Avisé is, verifiably, the only French player that answers "quel âge pour ce titre ?" across films, séries **and** jeux vidéo, in one database, with per-child personalization, and — uniquely — *before* a title is even released. The incumbent (filmspourenfants.net, ~224K visits/month) owns the film+âge SERPs but is a one-man volunteer operation with no games, no accounts, and a manual method that structurally cannot cover pre-release titles. The state regulates access (contrôle parental, majorité numérique) but supplies no per-title judgment. Common Sense Media has zero French presence. Nobody in the world has yet built a *trusted* AI-operated family media guide — the lane is open, and Totem's glass-box architecture (published criteria, deterministic safety floors, community calibration) is the exact playbook the strongest precedent (Kijkwijzer's 25 years of algorithmic ratings trusted by Dutch parents) says can win.

**The one-line strategic thesis.** The SEO beachhead is real and compounding, but it is rented land whose lease expires this quarter (AI Overviews reach France by 23 September 2026, and our own Belgium/Switzerland data predicts −55–85% CTR); the durable business is the layer no answer box can serve — per-child fit, community votes, brand, and embedded distribution — and the window to convert traffic into that layer is now.

**Five hard truths (numbers, not vibes):**
1. **The funnel does not exist.** ~1,920 clicks in 3 months (accelerating), but **12 non-admin accounts all-time** and ~2 signups/month — flat while traffic grew 7×. Visit→signup ≈ 0.5% and *not compounding*. Nothing on the pages that get the traffic asks for a signup.
2. **Zero brand.** Brand queries: 0 clicks, 16 impressions in 3 months. Nobody searches "totem avisé". Brand/navigational demand is the only query class AI Overviews can't intercept — and we have none.
3. **The SEO model has a dated expiry.** French AI Overviews arrive between now and 23 Sept 2026. In Belgium and Switzerland — where French-language AI Overviews are already live — our CTR at comparable positions runs 0.56–1.79% vs 3.4–3.7% in France: a −55–85% haircut, consistent across all three export windows, in line with Ahrefs' measured −58%.
4. **Click concentration.** The top fiche (L'Odyssée) is 24.7% of all clicks; the top 10 are 44%. One theatrical calendar hiccup or one lost snippet moves the whole curve.
5. **The community flywheel hasn't started.** 4 age votes, 9 reviews, 19 trigger votes, 48 reactions all-time. The trust model ("estimation IA affinée par les familles") is a promise the data can't yet demonstrate.

**Five real strengths (equally grounded):**
1. **Growth is genuinely compounding**: 6 consecutive weeks at ~+30–40% (W22: 71 clicks → W27: 439; W28 pacing ~1,000/week), position 7.3 → 5.6, CTR rising — on a domain with near-zero authority.
2. **The whitespace is real**: only 3-media player; only pre-release answerer (on "L'Odyssée quel âge", we are the *only* result giving an age); only player with accounts/personalization; games+âge SERPs are essentially unowned (PédaGoJeux: ~9.6K visits/month, 5% from search).
3. **A production machine no competitor can match**: 11,662 titles (99.7% enriched), 11,627 rows touched by pipelines in 30 days, 565 news stories published, ~$5/month marginal AI cost, one operator. filmspourenfants needs ~2× a film's runtime *per review*.
4. **The long tail works**: 767 distinct pages earned ≥1 click — the catalog ranks broadly, not just one hit.
5. **A regulatory tailwind rated 8/10**: four French laws in four years, a presidential commission, carnet-de-santé screen guidance, and an under-15 social-media ban landing at rentrée 2026 keep parents permanently primed to ask exactly the question we answer. The state manufactures the anxiety and leaves the per-title answer to the market.

---

## 2. The market

### 2.1 Size

| Layer | Estimate | Basis |
|---|---|---|
| French families with ≥1 child <18 | **7.94M households** (14.0M children) | INSEE 2022 ([familles](https://www.insee.fr/fr/statistiques/2381508), [enfants](https://www.insee.fr/fr/statistiques/2381504)) |
| Children 3–17 | ≈11.8M | derived from [INSEE population par âge](https://www.insee.fr/fr/statistiques/2381474) |
| Behavior: kids 10–17 playing video games | **95%** (6.2M) | [SELL/Médiamétrie 2024](https://www.sell.fr/sites/default/files/essentiel-jeu-video/ejv_octobre_2024_0.pdf) |
| Parents who check PEGI before buying | **62%** | SELL 2024 (ibid.) |
| Cinema: under-14 admissions 2024 | 7.3M spectators (+3.7%), 27.2% of cinemagoers attend *as family* | [CNC Bilan 2024](https://www.cnc.fr/professionnels/etudes-et-rapports/bilans/bilan-2024-du-cnc_2388088) |
| SVOD reach | 74% of homes, avg 2.5 paid services | [Médiamétrie/Arcom 2025](https://www.cbnews.fr/etudes/tv-svod-bvod-comment-les-francais-consomment-video-2025) |
| Screen time 6–17 | >4h/day | [Rapport "Enfants et écrans", avril 2024](https://www.elysee.fr/admin/upload/default/0001/16/fbec6abe9d9cc1bff3043d87b9f7951e62779b09.pdf) |
| Parents feeling "helpless" about digital parenting | **53%** (only 44% configured any control) | [OPEN/Ipsos 2024](https://www.open-asso.org/parents-enfants-numerique-2024-rapport-de-letude/) |

**Money envelope**: TAM ≈ **€70–110M/yr** (France pro-rata of the European family-digital-safety market ≈ €60–90M, plus the audience/licensing value of a dominant family-media guide at CSM-scaled reach of ~0.8–1.3M visits/month). SAM for a French-language guide with product ≈ **€8–15M/yr** (the 4–5M actively-checking households). Realistic 24-month SOM: **€50–250K/yr** at 100–300K visits/month — the constraint is distribution, not demand.

### 2.2 Demand shape (from our own data)

The demand unit is the **release-driven query cluster**: every family film/game spawns dozens of phrasings of the same question ("quel âge", "âge minimum", "à partir de quel âge", "déconseillé aux moins de..."). One 2026 blockbuster (L'Odyssée) generated 15+ distinct formulations and ~1,500 impressions in 3 months *for us at position ~4 on a near-zero-authority domain* — implying per-blockbuster national demand in the tens of thousands of searches/month. 92.8% of our query-attributed clicks are age-intent. Demand renews perpetually with the release calendar; the CNC explicitly credits family films with driving 2024 admissions.

### 2.3 Regulatory & societal tailwind — strong (8/10)

France has spent four consecutive years legislating childhood screens: loi Studer (contrôle parental par défaut, in force July 2024), majorité numérique (2023, superseded), the **under-15 social-media ban voted in 2026 with enforcement targeted at rentrée 2026**, SREN age verification (measurably working: −35% minor time on porn sites in a year), carnet-de-santé screen guidance since Jan 2025, écrans banned in crèches (June 2025), a citizens' convention reporting through 2026, and EU DSA minor-protection guidelines with France piloting the age-verification app. Full citations in the research annex (§9).

**Why this favors us rather than crowding us out**: every instrument regulates *access* or raises *awareness*; none supplies per-title judgment. jeprotegemonenfant.gouv.fr covers parental controls, not "can my 9-year-old watch this?". The CSA visa answers a legal question, not a parenting one — "Tous publics" covers both Vaiana and most adult dramas, and that mismatch is literally our top query driver. Crowd-out risk: low; no state per-title database is planned.

---

## 3. Competitive map (France)

*Ten live SERP checks were run (July 2026) across theatrical, streaming, séries, games and generic queries. Full profiles + links in annex §9.1.*

| Player | Coverage | Age per title? | Accounts/perso? | SEO on "quel âge" | Model | Verdict |
|---|---|---|---|---|---|---|
| **filmspourenfants.net** | Films + séries (~2,000 fiches) | Yes (manual, deep) | No | **#1 on 6/10 tested queries** | Volunteer, Tipeee | **Threat #1** — but capped: no games, no product, key-man risk, can't do pre-release |
| **Totem Avisé** | Films + séries + jeux (11,662) | Yes (AI + floors + community) | **Yes (only one)** | #3 on pre-release, absent on catalog blockbusters | Free, no ads | The only 3-media, pre-release, personalized player |
| Ayther.fr | Entertainment content farm | Shallow "X quel âge" posts | No | Fast on every release (~221K visits/mo, 75% search) | Ads | Erosion threat on positions 3–5 |
| Allociné (Webedia) | Films (tranches d'âge editorial) | Partial ("Dès X ans" labels) | No perso | #1 generic "film pour enfant 8 ans", absent titre+âge | Ads | **Dormant giant** — could crush if they systematize age blocks |
| Citizenkid | Sorties famille | Tranches | No | Visible on generic | Ads/local | Adjacent |
| Benshi | Curated kids' films | Curation dès 2 ans | SVOD subs | Weak on "quel âge" | Subscription SVOD | Adjacent, quality brand |
| PédaGoJeux (UNAF) | Games pedagogy | No titles | No | **Absent even on Fortnite/Roblox** (~9.6K visits/mo) | Public/collective | Games whitespace is empty |
| filmages.ch | Films (Swiss commission) | Yes (légal + suggéré) | No | Ranks #2–5 in France on classics | State | Useful precedent, not a competitor |
| Common Sense Media | US giant | Yes (EN only) | No perso | **0 presence on French SERPs** | Nonprofit $38M | Latent only if it localizes (no sign) |
| jeprotegemonenfant.gouv.fr | Parental controls | **No titles** | No | Absent on titre+âge | State | Complementary |
| Netflix/Disney+ built-in | Own catalog | Coarse bands | Profiles | N/A (walled) | — | Doesn't answer the Google-moment question; 90% of parents never configure it |

**SERP ownership summary**: films/séries + âge = filmspourenfants quasi-monopoly · jeux + âge = no French authority (foreign blogs, Epic/Roblox official pages) · generic "film pour enfant X ans" = Allociné/Citizenkid · **pre-release + âge = Totem alone**.

**Positioning axes** — where Totem is alone: (1) *artisanal ↔ systematized at scale*: everyone else is either handcrafted (FPE, Benshi) or shallow (Ayther); (2) *mono-média ↔ trois médias*: unique; (3) *editorial ↔ personalized product*: unique (nobody else has accounts). The credible attack on the incumbent is not frontal (beating FPE on Vaiana) but **around**: pre-release velocity, games, long tail, personalization — while FPE cannot follow without abandoning its identity.

---

## 4. Traction reality check

### 4.1 What's working — acquisition

- Weekly clicks: W22 **71** → W23 94 → W24 194 → W25 257 → W26 377 → W27 **439** → W28 pacing ~1,000 (458 in 3 days). Six weeks of ~+30–40% compounding.
- Average position 7.3 → 5.6 in five weeks; CTR 3.0% → 5.5%.
- 3-month windows: 276 clicks (June 13 export) → 463 (June 19) → **1,920** (July 10); impressions 9.7K → 60.4K.
- 767 pages with ≥1 click; 1,000 pages with impressions (GSC cap) — broad catalog ranking, not a single hit.
- Winners are exactly the designed plays: **pre-release theatrical fiches** (L'Odyssée: 475 clicks *before* its July 15 release; Spider-Man Brand New Day: 172 pre-release; Toy Story 5), horror-adjacent parental checks (Backrooms game + film), and evergreen catalog (a 1952 western earns 13 clicks). The striking-distance SEO agent demonstrably works — its two hand-optimized titles are the #1 and #2 pages.
- Geo: 93% France; diaspora (BE/CH/CA) is the AI-Overview canary (§6). Mobile 78%.

### 4.2 What's not working — conversion & engagement

| Funnel stage | 3-month value | Note |
|---|---|---|
| Impressions | 60,407 | +522% vs first window |
| Clicks | 1,920 | +596% |
| **Registered accounts (all-time)** | **14** (12 non-admin) | ~2/month, **flat while clicks grew 7×** |
| Verified accounts | 10 | |
| Family member profiles | 25 | 10 with completed quiz |
| Reactions / reviews / age votes / trigger votes | 48 / 9 / 4 / 19 | all-time |

The site converts search intent into answers, then lets 99.5% of visitors leave without an ask. The fiche — where 96% of clicks land — historically buried its signup value proposition. **Every promise that depends on community calibration ("affiné par les votes des familles") and every retention surface (Coin Famille) starves at these volumes.** Meanwhile the automation produced 565 news stories for what is effectively an audience of a dozen registered families: a production/demand imbalance that is a cost strength but a focus warning.

### 4.3 Concentration & dependence risks

- Top-1 page = 24.7% of clicks; top-10 = 44%. Release-calendar dependence is structural (it is also the moat — see §6).
- ~100% of acquisition is one channel (Google organic) in one country, on one query class — the class most exposed to AI Overviews.

---

## 5. SWOT (each cell anchored in a number)

| | Helpful | Harmful |
|---|---|---|
| **Internal** | **S1** 3-media × pre-release × personalization: literally no competitor has any of the three (10 SERP checks). **S2** Marginal cost ~€5/mo vs FPE's 2×-runtime-per-review; 11.6K enriched titles vs FPE's ~2K. **S3** Compounding SEO (+35%/wk × 6 weeks) on near-zero domain authority. **S4** Glass-box trust architecture already built (published method, deterministic floors, community hooks) — matches the only proven systematized-trust precedent (Kijkwijzer, 25 yrs). **S5** Full-stack automation survives founder attention gaps (self-healing crons, supervision). | **W1** 12 real accounts; conversion ≈0.5%, flat. **W2** Zero brand demand (0 brand clicks/3mo). **W3** Community flywheel unstarted (4 age votes). **W4** Blog empty (15 reviewed drafts unpublished) = zero topical-authority signals beyond fiches; collections/age pages invisible in search (1 click/3mo combined). **W5** Single operator, single channel, single country. **W6** No precedent anywhere of AI-operated guide earning parent trust — we must create the category's legitimacy ourselves. |
| **External** | **O1** Games+âge SERPs unowned (PédaGoJeux dead; Fortnite/Roblox queries held by blogs). **O2** Regulatory drumbeat (rentrée 2026 <15 ban) = permanent free awareness for the exact anxiety we answer. **O3** AI-assistant citation slot for French family-media is vacant — no entrenched authority to displace. **O4** FPE key-man risk: the whole incumbent is one volunteer educator. **O5** B2B embedding precedents proven elsewhere (CSM↔Comcast/Apple; Dove's $250/mo data feeds) with French analogs untouched (ISP family offers, médiathèques, écoles). | **T1** AI Overviews in France ≤ Sept 23, 2026: BE/CH proxy says −55–85% CTR on generic age queries; EV ≈ −50% of pure-SEO yield in 24 months. **T2** Allociné/Webedia systematizing "quel âge" blocks would leverage crushing domain authority (owns jeuxvideo.com too). **T3** Ayther-class content farms squat positions 3–5 on every release. **T4** Google algorithm updates: 100% channel dependence. **T5** Any public "AI reviews for kids" backlash lands on us first (no human-team shield). |

---

## 6. The two bets on the table

### 6.1 Coin Famille (imminent, registered users)

**The honest sequencing critique**: Coin Famille is a *retention* product being launched into an *acquisition-conversion* vacuum. At 12 accounts, even a perfect daily hub changes nothing measurable. Its launch matters only as part of a funnel: fiche traffic → signup reason → onboarding (now genuinely working — fixed July 11) → Coin Famille as the daily habit that justifies the account.

**What must be true for it to matter** (and is now largely true): (a) the fiches that get 96% of clicks present a concrete, personal reason to register — "l'âge parfait pour *votre* enfant, pas un âge moyen" — at the moment of the age answer; (b) onboarding survives first contact (fixed: redirect revived, quiz chain unbroken, age-tuned); (c) Coin Famille gives a *daily* reason to return (news + tonight + upcoming: it does, and no competitor has anything like it). **Verdict: right product, right differentiation (it is the anti-AI-Overview layer), launched one funnel-step too early — ship it, but pair it immediately with the fiche→signup ask.**

**Measure** (benchmarks from the research annex §9.4): fiche→signup rate — realistic planning range for a niche utility is **0.5–2% of visitors/month, 3–6% for high-utility niches**; registered users are the asset (they convert to paid at **45× the anonymous rate** — Piano). The strongest documented signup hook is exactly what the fiches already have latent: the **"save/favorite" feature gate** ("gardez la liste de votre famille"), which outperformed a newsletter form 16× in the one head-to-head test on record, and which Google explicitly blesses SEO-wise (`isAccessibleForFree` markup + flexible sampling — the Mather case showed a correctly-metered gate costing zero pageviews). For Coin Famille itself, the right metric is **WAU/MAU, not DAU/MAU** (family media planning is a weekly ritual): 40% WAU/MAU good, 55%+ great; DAU/MAU 10–15% at launch, 20% = habit formed; **~30% of new members still active at month 6 = good, 50% = great** (Lenny consumer-transactional bar). One structural encouragement: daily-refreshed content is the one mechanic known to lift long-run retention ~3× (news-category D30 9–13% vs utility ~3%) — the daily brief design is the right bet. Long-run ceiling to model against: SensCritique's registered base ≈ 20% of monthly uniques, accumulated over a decade.

### 6.2 Totem chatbot (later)

The chatbot is the **hedge against the answer-box era**: if parents stop clicking blue links, the site's owned conversational surface is where the personalized answer lives ("est-ce que Backrooms convient à Léa, 9 ans, sensible aux jump scares ? Non — et voici pourquoi, et 3 alternatives qu'elle aimera"). No answer box can do this — it requires the family profile. Conditions to flip `TOTEM_PUBLIC`: (1) data-layer safety floors (done July 11), (2) cost ceiling per conversation validated in admin alpha, (3) a visible entry point on fiches ("Posez la question pour votre enfant") so it converts traffic rather than serving the already-converted. It is also the natural PR hook for the glass-box story ("the first family media guide with an assistant that knows your kids' sensibilities — and shows its method").

---

## 7. Monetization outlook (compatible with "no ads, no affiliation")

*Benchmarks from the monetization research sweep (annex §9.4).*

**Reference points**: freemium converts a **median ~2%** of engaged users in Western Europe (RevenueCat 2026); micro-priced tiers convert ~half as well and realize ~7× less LTV than higher-priced ones; annual plans retain 44% at 12 months vs 17% monthly. Even **Common Sense Media's metered paywall + licensing covers only ~34% of its budget** (FY2024: $12.9M program revenue vs $43.6M expenses, −$5.6M deficit) — consumer subscription is a contribution margin, not a business model, even for the category king. The proven paths for small independents are: symbolic supporter memberships ($1–2/month, Kids-in-Mind, framed as independence support, not paywall), donations from identity-aligned audiences, and above all **B2B licensing of the ratings data** (Dove: ~$250/month data feeds; CSM: ratings embedded in Apple TV/Comcast reaching 100M homes). The one fatal move on record: Screen It's hard paywall (dead April 2023).

**Ranked for Totem (24-month horizon):**
1. **Nothing yet — deliberately.** Below ~50K visits/month every hour spent on monetization is stolen from the funnel. The €5/month cost base makes patience free — this is the structural advantage.
2. **Médiathèques via the BPI "coopération numérique" catalog — the one B2B door open to a solo operator.** The BPI took over the Réseau Carel referencing mission in Jan 2025; listing is free with one hard condition (a transparent public price grid), and comparable niche resources (Skilleos, Tënk, ToutApprendre) invoice per-adhérent/per-establishment. Realistic tickets for a guidance resource: **€1–5K/yr per collectivité** (the €18–33K figures are full VOD catalogs carrying licensing costs Totem doesn't have). Packaging: a patron-facing "quel film/jeu pour quel âge" portal embedded via the same Archimed/Décalog integrations Skilleos uses. Sales cycle: one deal at a time, budget season autumn — invoiceable within 6–12 months.
3. **CSE via aggregators (the ToutApprendre playbook)** — get listed as an "offre partenaire" on HelloCSE/Leeto/Club Employés (they want catalog breadth; parenting is an established CSE category — Les Parents Zens, May). Thin unit economics (benchmark: €0.15/employee/month for whole platforms): treat as cheap acquisition + a white-label subscription tier, not a primary line.
4. **Ratings-data licensing — highest value, longest shot, genuine whitespace.** French operators license parental-control *apps* (Orange×Xooloo at €3.50/mo, Bouygues×Qustodio at €5/mo, SFR×F-Secure, Free×McAfee — all driven by loi Studer) but **no one in France licenses per-title family-suitability data**. The model is proven elsewhere: Sky (UK) integrated Common Sense Media's ratings incl. the detail categories on Sky Q in 2019 (~12M users). The asymmetric French bet: one conversation with **Plurimedia/Media Press** (Télérama's TV-metadata supplier) about a family-suitability enrichment layer for French EPGs.
5. **Supporter membership** ("Ami de Totem", €2–3/mo or ~€25/yr, annual-first) once brand affection exists — funds independence, never gates the core.
6. **Premium personalization tier** (~€39/yr annual-first per benchmarks, *not* €2.99/mo) — only after free personalization has proven weekly retention; pricing page rebuilt then (the old one was rightly deleted July 2026).
7. **Never**: display ads, affiliation, pay-for-rating — the independence promise is the licensing asset's value.

École/Éducation nationale route for completeness: GAR adhesion is doable (2–3 months, no stated fee) and Édu-up can subsidize up to €70K of production, but actual revenue runs through collectivité procurement won by consolidators (€7.6M–90M framework contracts) — a long-game partnership route (CLEMI convention = reputational), not a 24-month revenue line.

---

## 8. Recommendations

### Positioning statement (aligned with the Vivatech glass-box narrative)

> **Totem Avisé est le guide familial qui répond avant tout le monde, pour votre enfant en particulier.** Films, séries et jeux — un âge conseillé argumenté dès l'annonce du titre, des critères publiés et vérifiables (la méthode Kijkwijzer, à l'échelle de l'IA supervisée), affinés par les votes des familles, et des recommandations qui connaissent les sensibilités de *vos* enfants. Indépendant, sans publicité, gratuit.

Against each rival in one line: vs FPE — "trois médias, avant la sortie, pour votre enfant" · vs Ayther — "une méthode publiée, pas une ferme à contenu" · vs the state — "le jugement par titre que l'État ne fournit pas" · vs AI Overviews — "un âge moyen ne connaît pas votre enfant".

### 90-day priorities, ranked by leverage

1. **Build the fiche→signup funnel (the single highest-leverage move).** Two evidence-backed hooks at the moment of the age answer: the personalized one ("Cet âge est une moyenne — voyez s'il convient à *votre* enfant") and the **save/favorite feature gate** ("Gardez la liste de films de votre famille" — the #1 documented signup driver on content sites, 16× a newsletter form), post-signup landing in Coin Famille. SEO-safe by design: full content stays indexable, gated features carry the `isAccessibleForFree` pattern Google documents. Target: 0.5% → 2%+ of clicks. Everything else depends on this.
2. **Ship Coin Famille publicly** (it's ready) as the signup *reason*, and instrument D7/W1 retention from day one.
3. **Prepare for AI Overviews now** (arrival ≤ Sept 23): one-line quotable age verdicts high on every fiche, bulletproof structured data, the methodology page linked from every fiche (citation bait), and **monitor the France-vs-BE/CH CTR gap monthly as the live gauge** — it is the best AIO dashboard anyone in France has.
4. **Claim the games whitespace this quarter**: nobody owns "fortnite quel âge" / "roblox quel âge" — a dedicated games-parents angle (PEGI + pourquoi + alternatives par âge) can take a whole query class before AIO lands on it.
5. **Publish the 15 reviewed blog drafts** (2/week cadence): topical authority beyond fiches, AIO citation surface, and the newsletter's content engine. An empty blog undermines the "guide" claim.
6. **Systematize the L'Odyssée play**: the release-calendar pre-enrichment loop (announce → provisional age → day-one fiche) is the moat AI Overviews can't fill (thin corpus pre-release). Every 2026-2027 family release should have its fiche ranking *before* the première.
7. **Start one embedding conversation — concretely: the BPI "coopération numérique" catalog** (the médiathèque referencing channel, open to small providers, free listing, transparent price grid required). Distribution beats destination — the CSM lesson — and this is the one French B2B door a solo operator can realistically open within 6–12 months. Even one pilot médiathèque is a credibility anchor for press and future licensing.
8. **Brand-building basics**: consistent name presence in every snippet/OG, the press pitch (pitch-press.md) actually sent — brand queries are the only AIO-proof demand, and we're at zero.

### Metrics that matter (weekly dashboard)

| Metric | Now | 90-day target | Benchmark anchor |
|---|---|---|---|
| Weekly GSC clicks (FR) | ~440 | 1,500+ (watch AIO inflection) | own trend |
| France vs BE/CH CTR gap | −55–85% (proxy) | tracked monthly as AIO gauge | Ahrefs −58% |
| Fiche→signup conversion | ~0.5% | ≥2% | 0.5–2%/mo typical, 3–6% niche-great |
| Registered families (non-admin) | 12 | 100+ | SensCritique long-run ceiling: ~20% of uniques |
| WAU/MAU of activated families | n/a | ≥40% | 40% good / 55% great |
| M1 member retention (M6 later) | n/a | ≥50% (M6: ≥30%) | 30% M6 good / 50% great |
| Community votes/week (age+trigger) | <2 | 25+ | flywheel start |
| Brand-query clicks/week | 0 | first non-zero trend | only AIO-proof demand |
| Newsletter/digest CTR (when live) | n/a | ≥3–4%/send | childcare niche = top email quartile |

---

## 9. Research annexes (full agent reports)

The four commissioned research reports are preserved verbatim below for traceability. Every claim above traces to §9.1–9.4, the GSC CSVs in `dump/GoogleSearch/`, or the production DB queries of 2026-07-11.

### 9.1 French competitive landscape — key extracts
- filmspourenfants.net: founded 2008 by Jacques Métille (éducateur spécialisé), ~2,000 fiches, 100% manual (~2× runtime per review), volunteer + Tipeee, ~224K visits/mo, #1 on 6/10 tested age queries, snippet-optimized titles, **no games, no accounts, no pre-release capability** ([qui sommes-nous](https://www.filmspourenfants.net/qui-sommes-nous/), [HypeStat](https://hypestat.com/info/filmspourenfants.net)).
- SERP checks (10 queries, July 2026): FPE #1 on Vaiana 2 / Minecraft / KPop Demon Hunters / Stranger Things / Harry Potter; **Totem #3 and only age-answerer on "L'Odyssée quel âge"**; games queries owned by gameboost.com/Internet Matters/blogs; Allociné #1 on generic "film pour enfant 8 ans"; PédaGoJeux absent everywhere ([details in report](—)).
- Common Sense Media: **0 appearances in French SERPs**, no FR localization ([commonsensemedia.org](https://www.commonsensemedia.org/)).
- Ayther.fr: ~221K visits/mo, 75% search, "X quel âge" content farm ([HypeStat](https://hypestat.com/info/ayther.fr)).
- Benshi (VOD Factory): curated kids' SVOD, ~124K visits/mo ([benshi.fr](https://benshi.fr/)).
- AI Overviews **not yet live in France** (droits voisins), announced for été 2026 / before 23 Sept 2026 ([Abondance](https://www.abondance.com/20260623-2493011-ai-overviews-google-debarque-france.html), [Blog du Modérateur](https://www.blogdumoderateur.com/google-ai-overviews-france-ete/)).

### 9.2 International models — key extracts
- **Common Sense Media**: 159 staff; FY2024 revenue $37.98M (65% philanthropy, 33.9% program services incl. licensing to Apple TV/Comcast/Target/OpenAI), expenses $43.57M (−$5.6M) ([ProPublica 990](https://projects.propublica.org/nonprofits/organizations/412024986)); ratings embedded in >100M US homes; 1.2M educators trained via free K-12 curriculum ([Common Sense Education](https://www.commonsense.org/education/digital-citizenship)); ~6.4M visits/mo, 64% organic ([Similarweb](https://www.similarweb.com/website/commonsensemedia.org/)). **Won on distribution + institutional embedding, not review quality. No personalization.**
- **Kids-in-Mind**: 2 people since 1992; structured 0–10 scales; $1–2/mo memberships; now besieged by AI scrapers, markets itself "humans not AI" ([about](https://kids-in-mind.com/about.htm)).
- **Screen It**: hard paywall → invisibility → dead (last review 21 April 2023) ([notice](https://www.screenitplus.com/members/login.cfm)).
- **Kijkwijzer/NICAM (NL)**: trained coders fill a scientific questionnaire; **the rating is derived algorithmically**; trusted by Dutch parents for 25 years; industry-funded ([NICAM](https://www.kijkwijzer.nl/en/about-kijkwijzer/about-nicam/)). *The strongest precedent that systematized ratings with published criteria earn mass parent trust.*
- **FLIMMO (DE)**: free traffic-light parents' guide across TV/streaming/YouTube, funded by state media authorities ([flimmo.de](https://flimmo.de/ueber-flimmo/herausgeber)) — proves demand for a modern free guide in a big EU market; no French equivalent exists.
- **filmages.ch**: cantonal commission, âge légal + âge suggéré with published criteria since 1999 ([filmages.ch](http://www.filmages.ch/)) — the francophone register Totem's "âge conseillé / à confirmer" already speaks.
- **Dove Foundation**: licensed its family seal + data at ~$250/mo ([dove.org](https://dove.org/content-licensing/)).
- **No AI-native trusted guide exists anywhere (mid-2026)**; current AI entrants are anonymous ad farms (e.g. cineparenting.com). The lane is open; the playbook: published criteria (Kijkwijzer), structured per-criterion scores (Kids-in-Mind), per-child personalization (Screenwise validates solo feasibility), distribution instinct (CSM), independence stated loudly.

### 9.3 Market, regulation, AI-search — key extracts
- Demographics/behavior: INSEE 7.94M families; SELL 95% of 10–17s play, 62% of parents check PEGI; CNC 2024 family-driven admissions; OPEN/Ipsos 53% of parents feel helpless (sources in §2 table).
- Regulation timeline 2022–2026 with statuses (loi Studer in force 13 July 2024; <15 social-media ban voted Jan/Mar 2026, enforcement rentrée 2026; SREN working: −35% minor porn-site time; carnet de santé + crèche screen ban 2025) — all cited in §2.3.
- **AI Overviews evidence**: Pew −47% relative clicks when AIO present ([Pew 2025](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/)); Ahrefs −34.5% → **−58%** (Dec 2025 update, position-1 CTR 0.073→0.016) ([Ahrefs](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/)); 99.2% of AIO triggers are informational; France excluded until now by droits voisins; deployment window **late June – 23 Sept 2026** ([Abondance](https://www.abondance.com/20260623-2493011-ai-overviews-google-debarque-france.html)).
- **Proprietary natural experiment** (our GSC, three windows): France CTR 3.37/3.36/3.69% vs Belgium 0.81/0.56/0.90% and Switzerland 1.72/1.79/1.53% at comparable positions — French-language AIO markets show **−55–85% CTR**. Probability-weighted 24-month expectation: ~50% of pure-SEO click yield lost (65% heavy-coverage scenario / 25% partial / 10% offset-by-citation).
- Survival levers: AIO citation (+35% CTR possible for cited sources), day-one freshness (thin-corpus window), product layer (per-child fit, community data), AI referrals (16× growth but ~0.32% of traffic — 1:10 replacement at best), brand queries (AIO-proof; currently zero).

### 9.4 Growth & monetization benchmarks — key extracts
- Freemium: median download→paid **2.1–2.2%** (RevenueCat 2025/2026), Western Europe 2.0%; hard paywall 10–12% but kills discovery; trial→paid 25–45%; **low-priced tiers: ~half the conversion, ~7× lower 1-yr LTV** ($8 vs $55); annual retains 44.1% at 12 months vs 17.0% monthly ([RevenueCat](https://www.revenuecat.com/state-of-subscription-apps/)).
- French price anchors: Xooloo €2.99–6.99/mo; Qustodio €46.95–79.95/yr; May €6.99–12.99/mo (claims 500K parents); Bayam ~€90/yr; CSM Plus $3.99/mo / $39.99/yr metered after 3 free reviews/month ([join page](https://www.commonsensemedia.org/join)).
- WTP: FOSI 86% of parents *say* they'd pay for usage reporting; revealed behavior much weaker; French WTP structurally depressed by free ISP/OS controls (loi Studer).
- CSM's own economics (−$5.6M on $38M revenue) prove consumer subscription ≠ business model even at category-king scale; licensing + philanthropy carry it.

**Visitor→account conversion (registration-wall research):**
- Soft registration wall: **~3.1% of wall hits register**; correctly-metered wall = zero pageview loss; known users grew 5.8× in 12 months ([Mather Economics](https://www.mathereconomics.com/2022/02/10/an-inside-look-on-how-registration-walls-impact-subscriber-growth/)).
- **Registered → paid at 9.88% vs anonymous 0.22% (45×)**; only ~1.2% of a median publisher's users are logged in without a deliberate hook ([Piano 2022/2024](https://www.piano.io/marketing/content/subscription-performance-benchmarks-2024)).
- **"Save/favorite" is the #1 documented signup driver** on content sites (Grow/Mediavine; 16× a newsletter form in the Salem Reporter A/B, [Leaky Paywall](https://leakypaywall.com/registration-wall-vs-newsletter-signup/)).
- Google's official pattern for SEO-safe gating: full content indexed + `isAccessibleForFree: false` on gated parts + ~10 free pages/month metering ([Search Central](https://developers.google.com/search/docs/appearance/structured-data/paywalled-content)); the WSJ lost 44% of search traffic gating carelessly (2017).
- Long-run registered-base ceiling: SensCritique ≈ 1.3M members vs ~6M uniques (~20%, built over a decade) ([Next.ink](https://next.ink/17385/96073-sens-critique-genese-aux-projets-a-venir/)).

**French B2B channels (accessibility-ranked):**
- **Médiathèques**: BPI took over the Réseau Carel referencing mission Jan 2025 ([ActuaLitté](https://actualitte.com/article/120013/bibliotheque/ressources-numeriques-des-bibliotheques-la-bpi-prend-le-relais-du-reseau-carel)); free listing, transparent price grid required; niche-resource precedents Skilleos (>96% renewal, per-adhérent pricing), Tënk, ToutApprendre (sold to BOTH bibliothèques and CSE); realistic ticket €1–5K/yr/collectivité.
- **CSE**: ~100K CSE covering ~20M employees, ASC budgets €3.7–15bn/yr; aggregators HelloCSE (4,500+ CSE)/Leeto/Club Employés are the rail; parenting is an established category (Les Parents Zens, May entreprise).
- **Écoles**: GAR adhesion 2–3 months, no stated fee ([gar.education.fr](https://gar.education.fr/fournisseurs-de-ressources/adherer/)); Édu-up subsidy ≤€70K; revenue gated by consolidator-won tenders (Grand Est €90M cap).
- **ISP/metadata**: Orange×Xooloo (2017, €3.50/mo), Bouygues×Qustodio (€5/mo), SFR×F-Secure, Free×McAfee — all *app* licensing under loi Studer; **no French precedent of per-title suitability-data licensing** = whitespace. Proven abroad: Sky Q integrated CSM ratings incl. detail categories, ~12M users (2019, [THR](https://www.hollywoodreporter.com/tv/tv-news/sky-add-common-sense-media-ratings-system-1148192/)). Asymmetric bet: Plurimedia/Media Press (Télérama's metadata supplier).

**Retention/engagement benchmarks (for Coin Famille):**
- App-category anchors: utility D30 ~3%, **news D30 9–13%** (daily-refresh = the one ~3× retention mechanic); no vendor publishes a "parenting" category — treat any such claim as fluff.
- Stickiness: DAU/MAU 10–20% standard, >20% habit; **WAU/MAU is the right metric for weekly family rituals** (40% good, 55%+ great); month-6 member retention 30% good / 50% great (Lenny consumer benchmarks); Duolingo's 37% DAU/MAU is a streak-engineered outlier.
- Web median: only **13% of visitors return within 30 days** ([Contentsquare 2026](https://contentsquare.com/guides/digital-experience-benchmark/)) — beating that is already above-median.
- Email digests: judge on **CTR ≥3–4%/send** (opens are MPP-inflated); child-care is a top-quartile email vertical (47% opens, Constant Contact); theSkimm proves a female household-decision-maker audience sustains multi-year daily-email habits.

---

## 10. Bottom line

Totem Avisé has built, at ~€5/month of marginal cost, the machine that the French market lacks and that no competitor — volunteer, corporate, or state — is structurally positioned to replicate: three media, pre-release velocity, published method, personalization. The traffic proves the demand; the funnel proves nothing yet, because it hasn't been built; and the clock that matters is not a competitor's — it's Google's, with AI Overviews arriving in France within the quarter. The strategy that follows from the data is unusually unambiguous: **convert the compounding SEO into registered families now (fiche→signup→Coin Famille), claim the unowned games query class before the answer boxes do, make the glass-box method the citable French authority, and treat brand and embedded distribution — not rankings — as the destination.** Monetization can wait; the moat cannot.
