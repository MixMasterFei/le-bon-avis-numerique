# Totem Avisé — Editorial & RSS Source Map

Living reference for the French family-media ecosystem. Covers sources used by the automated Découverte feed (RSS pipeline), editorial inspirations for Totem's voice, and institutional/authoritative sources to cite in articles.

Last audit: April 2026. RSS URLs verified live at that date — re-verify before bulk changes.

---

## Positioning note (read this first)

Totem Avisé is **not** an editorial review site. It has no in-house journalists, no house age ratings or star scores, and no critic-style recommendations. What it does is:

- **Aggregate comprehensive data** on every movie, series, game, book, and app it catalogs (TMDB, IGDB, CNC classifications, etc.).
- **Personalize per family** — given a foyer's members (ages, sensitivities, interests), surface the content that fits *that* family, not the one an editorial team would recommend to everyone.
- **Amplify community feedback** — reactions, notes, age votes from parents using the service.

The information in this document — RSS pipeline sources, editorial references, institutional citations — serves that model. Sources feed the *Découverte* news signal and populate authority links on *À propos* / methodology pages. They are **not** editorial voices we're trying to imitate.

## Executive summary

- **The ecosystem is fragmented but solid.** French family-media info splits across four circles: institutional voices (Arcom, CNIL, Santé publique France), parenting-magazine media (Bayard, Magicmaman), vertical age-rating guides (PédaGoJeux for games, Benshi for kids' cinema, FilmAges.ch for Swiss film ratings), and mainstream news family desks (Le Monde *Darons Daronnes*, La Croix *Famille*, 20 Minutes *Famille*). None of these do what Totem does — personalized recommendations from aggregated data + community feedback — but each contributes useful news signal or authority for the site.
- **Four heavyweights to include in the pipeline:** PédaGoJeux (games, UNAF-backed, active RSS), La Croix *Enfants et adolescents* (valid RSS, editorial heft), Le Monde *Darons Daronnes* (valid RSS, reach), Fondation pour l'Enfance (institutional authority, active RSS).
- **V1→V2 key move:** drop essay/general-culture feeds (Le Monde Idées, Télérama Idées, France Inter générique, La Croix broad *univers_famille*) — they produce articles that don't cluster with peers. Replace with narrower, child/family-specific feeds and high-volume aggregators that give multi-source confirmation (AlloCiné split cine+series, 20 Minutes famille, Franceinfo jeunes).
- **What France does well:** institutional reports (Arcom, Santé publique France, INSERM, CNIL, Défenseur des droits) — rich authority citations for the site, mostly news-driven enough to cluster in the Découverte feed.
- **Quebec and Switzerland are stronger on some angles** — Naître et grandir (QC), FilmAges.ch (Swiss), Yapaka (Belgium, Serge Tisseron's 3-6-9-12 framework). Most lack RSS → cite, don't ingest.

---

## Tier A — RSS pipeline (the V2 list)

News-driven, French-language, family-relevant, RSS-verified. This is what lives in [src/lib/news-sources.ts](../src/lib/news-sources.ts).

| # | Source | RSS | Category | Trust | News/Essay | Family relevance | Why in V2 |
|---|---|---|---|---|---|---|---|
| 1 | **PédaGoJeux** | `https://www.pedagojeux.fr/feed/` | GAMES | 1 | News + guide | Strong | UNAF-backed reference on video games for parents. Every post is family-relevant by design. Zero noise. |
| 2 | **Le Monde — Darons Daronnes** | `https://www.lemonde.fr/darons-daronnes/rss_full.xml` | PARENTHOOD | 1 | News + essay | Strong | Le Monde's dedicated parenting vertical. Replaced the generic *Idées* feed from V1. |
| 3 | **La Croix — Enfants et adolescents** | `https://www.la-croix.com/feeds/rss/Famille/Enfants-et-adolescents.xml` | PARENTHOOD | 1 | News | Strong | Narrower than V1's `univers_famille`. Catholic-aligned but editorially rigorous. |
| 4 | **Fondation pour l'Enfance** | `https://www.fondation-enfance.org/feed/` | PARENTHOOD | 1 | News | Strong | Publishes the *Enfance & Numérique* barometer, runs the *Chasseurs d'Écrans* campaign. |
| 5 | **20 Minutes — Famille** | `https://www.20minutes.fr/feeds/rss-famille.xml` | PARENTHOOD | 2 | News | Medium-Strong | High volume, mainstream reach. Clusters reliably with La Croix and Le Monde. |
| 6 | **Franceinfo — Jeunes** | `https://www.franceinfo.fr/l-actu-pour-les-jeunes.rss` | PARENTHOOD | 1 | News | Strong | Public-service, kid-safe news. Clusters well with 1jour1actu. |
| 7 | **1jour1actu (Milan / Bayard)** | `https://feeds.feedburner.com/1jour1actu/BwmM3ey8dPF` | READING | 1 | News | Strong | Kids-aged news (8-12). Surfaces "what parents are explaining this week". |
| 8 | **Télérama — Enfants** | `https://www.telerama.fr/rss/enfants.xml` | FILM_TV | 1 | News + essay | Strong | Critical film coverage with family angle. Replaced V1's `idees.xml`. |
| 9 | **AlloCiné — Cinéma** | `https://www.allocine.fr/rss/news-cine.xml` | FILM_TV | 1 | News | Medium | Canonical feed; replaced the V1 legacy URL. |
| 10 | **AlloCiné — Séries** | `https://www.allocine.fr/rss/news-series.xml` | FILM_TV | 1 | News | Medium | Split from cinéma so FILM_TV picks up both sides. |
| 11 | **Sortiraparis — Enfant & famille** | `https://www.sortiraparis.com/rss/enfant-famille` | PARENTHOOD | 3 | News | Medium | High-frequency family events/releases. Keeps Découverte fresh when institutional feeds go quiet. |
| 12 | **IDBOOX — Livres enfants** | `https://www.idboox.com/livres-enfants/feed/` | READING | 3 | News + reviews | Strong | Kids-book reviews. Replaces Le Monde *Idées* in READING (mismatch in V1). |
| 13 | **France Culture — Être et savoir** | `https://radiofrance-podcast.net/podcast09/rss_11192.xml` | PARENTHOOD | 1 | Essay/podcast | Strong | Weekly education + transmission podcast. Lower cadence but every episode on-brief. |
| 14 | **Geek Junior** | `https://www.geekjunior.fr/feed/` | GAMES | 2 | News + reviews | Strong | Kids/teens-focused tech & gaming. Closest to a "kids gaming press" outlet in French. |
| 15 | **Nintendo-Master** | `https://www.nintendo-master.com/feed/` | GAMES | 2 | News | Medium-Strong | Nintendo-specific FR coverage — surfaces big Switch releases that kids care about. |
| 16 | **Numerama Pop** | `https://www.numerama.com/pop-culture/feed/` | GAMES | 1 | News | Medium | Mainstream tech outlet's pop-culture section. Covers big releases (Fortnite, Minecraft, Pokémon) with family-readable framing. |
| 17 | **20 Minutes Jeux vidéo** | `https://www.20minutes.fr/feeds/rss-jeux-video.xml` | GAMES | 2 | News | Medium | Mainstream gaming hits in family-readable language; helps cluster big stories with the other outlets. |

**V1→V2 changes applied:**
- Dropped: `lemonde.fr/idees/rss_full.xml`, `telerama.fr/rss/idees.xml`, `radiofrance.fr/franceinter/rss`, `la-croix.com/RSS/univers_famille`, Magicmaman, Famili, Première, BetaSeries, JeuxVideo.com.
- Added: Darons Daronnes, La Croix Enfants & ados, Franceinfo Jeunes, Fondation pour l'Enfance, Être et savoir, Sortiraparis enfant-famille, AlloCiné split, Télérama Enfants, PédaGoJeux, 1jour1actu, IDBOOX.

---

## Tier B — Good backups / support sources

Strong family/kids angle, lower frequency or harder RSS. Candidates for later expansion if V2 coverage thins.

| Source | URL | RSS | Trust | Notes |
|---|---|---|---|---|
| **Mouv'Enfants** | mouvenfants.fr | `https://mouvenfants.fr/feed` | 2 | Child-protection advocacy; signal for abuse, platform risks. |
| **Magicmaman** | magicmaman.com | `magicmaman.com/rss.xml` | 2 | Baby/pregnancy-heavy; filter by "école" / "écran" / "enfant". |
| **Famili** | famili.fr | `famili.fr/famille/rss` | 2 | Same caveat as Magicmaman. |
| **Radio-Canada — Cinéma** | ici.radio-canada.ca | `https://ici.radio-canada.ca/info/rss/sous-theme/cinema` | 1 | Québec perspective on releases. |
| **Radio-Canada — Livres** | ici.radio-canada.ca | `https://ici.radio-canada.ca/info/rss/sous-theme/livres` | 1 | Same. |
| **France Inter — Une histoire et… Oli** | radiofrance-podcast.net | `https://radiofrance-podcast.net/podcast09/podcast_d555ed4e-dbe5-4908-912e-b3169f9ceede.xml` | 1 | Story-for-kids podcast; content inspiration, not news. |
| **Spirou** | spirou.com | `https://spirou.com/feed/` | 3 | BD jeunesse news. Narrow but on-brief. |
| **We Demain — 100% ados** | wedemain.fr | `https://www.wedemain.fr/feeds/rss/100-pourcent-ados` | 2 | Teen-angle essays; low cadence. |
| **Pomme d'Api / Astrapi / Okapi (Bayard)** | bayard-jeunesse.com | No site-wide RSS | 2 | Brand authority for kids content. Manual reference. |

---

## Tier C — Editorial inspiration, NOT for pipeline

These shape Totem's voice but produce pure-essay, low-frequency, or no-RSS content. Reference for the brand-style doc and for citing in articles, not for automated ingestion.

| Source | Why it matters | Why not in pipeline |
|---|---|---|
| **Benshi — Le guide du cinéma pour les enfants** (guide.benshi.fr) | Editorial kids-cinema guide curated by Studio des Ursulines. Useful as a benchmark for age-banding in cinema and as a citation when Totem's catalog overlaps theirs — *not* a model Totem tries to emulate (they're editorial, Totem is personalization-driven). | No RSS; newsletter-only. Watch manually. |
| **FilmAges.ch** | Swiss commission (educators + psychologists + parents) publishing legal + recommended ages with thematic contra-indications. Best-in-class French-language age-rating model. | Database site, no news RSS. Use as citation/benchmark. |
| **Filmrating.ch** | Swiss national commission — legal age ratings with explanatory criteria. | Reference only. |
| **Ricochet Jeunes (IICJ, Suisse)** | Reference site on French-language children's/YA literature. | RSS blocked (403). Use as editorial authority for book sections. |
| **Naître et grandir (Fondation Chagnon, QC)** | Scientifically-reviewed, ad-free parenting reference covering pregnancy→8 years. Benchmark for evidence-based French family content. | Newsletter-only. Cite frequently; don't ingest. |
| **filmspourenfants.net** | Independent French DB of 2000+ kids' films with age recommendations. | Static site. |
| **apartirdequelage.fr** | Similar DB with stronger editorial reviews. | Static/low-frequency. |
| **Yakamedia / CEMEA** | Educational media-literacy think tank. | Low cadence, essay format. |
| **RTBF — Air de Familles** | Belgian public-service family program. Brand-voice reference for warm-but-rigorous tone. | Podcast-driven, no clean RSS. |
| **Apel — Famille & Éducation magazine** | Established parenting magazine from Association des parents de l'enseignement libre. | Subscription, no RSS. |

---

## Institutional & authoritative references

Citable sources for Totem articles and for the *À propos* / methodology page. Most don't RSS cleanly; link from the authority page, quote in articles.

| Source | URL | Use case |
|---|---|---|
| **Arcom** (ex-CSA) | [arcom.fr](https://www.arcom.fr/se-documenter/ressources-pedagogiques/protection-des-mineurs) | Official age signalétique authority. Annual "Enfants et écrans" campaigns, 2025-26 platform age-verification priorities. |
| **CLEMI** | [clemi.fr](https://www.clemi.fr/les-themes/parentalite-et-bien-etre-numerique) | National media-education authority. *Les écrans : apprendre à s'en servir pour ne pas les subir*. |
| **e-Enfance / 3018** | [e-enfance.org](https://e-enfance.org/informer/) | Reference for cyberbullying and digital violence. 3018 helpline is the institutional number. |
| **CNIL** | [cnil.fr](https://cnil.fr/fr/thematiques/les-droits-numeriques-des-mineurs) | 8-recommendation framework for minors' data; 15-year consent threshold. |
| **UNAF — Mon enfant et les écrans** | [mon-enfant-et-les-ecrans.fr](https://www.mon-enfant-et-les-ecrans.fr/) | National family-association digital-parenting resource. *P@rents, parlons numérique* label. |
| **jeprotegemonenfant.gouv.fr** | [jeprotegemonenfant.gouv.fr](https://jeprotegemonenfant.gouv.fr/ecrans/) | Government portal aggregating screen-time and online-protection resources. |
| **Santé publique France** | [santepubliquefrance.fr](https://www.santepubliquefrance.fr/presse/2025/temps-d-ecran-des-enfants-de-3-a-11-ans-un-usage-precoce-quotidien-et-marque-par-les-inegalites-sociales) | Enabee 2025 study: 3-11 year-olds screen-time data with social-inequality breakdown. Most citable recent French study. |
| **INSERM** | [presse.inserm.fr](https://presse.inserm.fr/ecrans-et-developpement-cognitif-de-lenfant-le-temps-dexposition-nest-pas-le-seul-facteur-a-prendre-en-compte/67438/) | Research voice on screens + cognitive development (Elfe cohort). |
| **Défenseur des droits** | [defenseurdesdroits.fr](https://www.defenseurdesdroits.fr/rapport-annuel-sur-les-droits-de-lenfant-2025-le-droit-des-enfants-une-justice-adaptee-990) | Annual rapport droits de l'enfant. 2025 edition on children's right to justice. |
| **UNICEF France** | [unicef.fr](https://www.unicef.fr/article/proteger-les-droits-de-lenfant-dans-un-monde-numerique/) | *Observatoire des droits de l'enfant* — 12-theme dataset including digital. |
| **Fondation pour l'Enfance** | [fondation-enfance.org](https://www.fondation-enfance.org/actualites/) | Enfance & Numérique 4th barometer (Feb 2026) + Chasseurs d'Écrans game. Also in Tier A. |
| **PEGI** | [pegi.info/fr](https://pegi.info/fr) | Games classification authority. |
| **CNC** | [cnc.fr](https://cnc.fr) | Film classification authority. Already imported in the catalog. |
| **Yapaka (FW-B, Belgique)** | [yapaka.be](https://www.yapaka.be/thematique/ecrans) | 3-6-9-12 screen-time framework by pédopsychiatre Serge Tisseron. Foundational reference. |
| **CSEM (Belgique)** | [csem.be](https://www.csem.be) | Conseil Supérieur de l'Éducation aux Médias — media-education thematic files and videos. |

---

## Gaps & risks

- **Age-rating coverage is fragmented by format.** Games → PEGI + PédaGoJeux (strong, usable in Totem's catalog). Films → CNC + FilmAges.ch (Swiss, best-in-class). TV → Arcom signalétique (weak, under-used by press). Books → no age-rating equivalent in French media. Apps → essentially uncovered. Totem's own aggregation layer fills these format-by-format gaps by combining PEGI/CNC data with community feedback.
- **Kid-game coverage is thin from a parent-first angle.** Gamekult and JeuxVideo.com are mainstream-gamer outlets; PédaGoJeux is the only parent-first voice. For Totem, the right play is to cross-reference IGDB releases against PEGI ratings inside the catalog rather than expect RSS to cover it.
- **Quebec and Belgium are stronger than France on some angles** (Naître et grandir for 0-8, Yapaka for screen-time frameworks, FilmAges for ratings) but almost none have usable RSS. Treat them as citation sources, not pipeline sources.
- **Essay fatigue risk.** V1 leaned on *Idées*-type feeds that produce beautiful but unclusterable content. V2 keeps essay feeds to ≤2 of 14 (Être et savoir, Darons Daronnes) and loads up on news-driven feeds that generate the same-story-three-ways signal the clustering needs.
- **No French outlet does what Totem does.** Several do pieces — Benshi reviews kids' cinema, PédaGoJeux reviews games for parents, Arcom sets signalétique — but none combine cross-format aggregation, per-family personalization, and community reactions. That's the moat; this source map exists so Totem can cite and synthesize from all of them without trying to become any of them.

---

## Research sources

Primary references consulted during the April 2026 audit:

- [Atlas des flux RSS — Jeunesse](https://atlasflux.saynete.net/atlas_des_flux_rss_fra_jeunesse.htm)
- [AlloCiné — RSS officiels](https://www.allocine.fr/service/rss/)
- [Milan Jeunesse — 1jour1actu](https://milan-jeunesse.com/mj/jeux-activites/magazines/1jour1actu)
- [Radio-Canada — Fils RSS](https://ici.radio-canada.ca/info/rss)
