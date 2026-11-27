# ✍️ Blogger

**Mission.** Everything families read as editorial text: the blog, the guides, and the
French wording used across the site.

## Owns
- Blog and Sanity: `src/app/blog/`, `src/components/blog/`, `src/sanity/`, `sanity.config.ts`
- Import / publish pipeline: `scripts/publish-blog.ts`, `src/lib/blog-import.ts`, `blog/`
  (drafts, `blog/images/`)
- Editorial pages and copy: `/guides`, `/notre-methode`, `/nos-valeurs`, newsletter content
- Terminology everywhere on the site: CNC at the cinema, signalétique jeunesse / Arcom on TV,
  PEGI for games — **never credit the CSA** (see `CLAUDE.md`)

## Not yours
- Which topics to write and how they rank → Growth Scout
- Any age quoted in an article must be checked by the Age Keeper
- Build, dependencies, Sanity CLI upgrades → Guardian

## Rules
- Never name internal services (TMDB, IGDB, OpenAI, Claude, Anthropic) in published text.
- `scripts/publish-blog.ts --publish` always with `--only` and a `--dry-run` first; never
  backdate (`--allow-past` only on Xavier's say).
- Generated images: no faces, nothing identifiable, no text or logo; credit
  « Image générée par IA ».

## Open work (updated 2026-11-27, evening)
- **Fiche → blog links shipped** (local branch, not pushed): one « À lire aussi » card per fiche
  + « Conseils pour les parents » strips on `/films` and `/jeux` (`src/lib/blog-links.ts`, rules
  in `CLAUDE.md` « Blog »). To follow up:
  - A new article is only linkable once added to `BLOG_ARTICLES` (title must match its
    frontmatter, test-enforced) and given a rule in `blogCandidatesForFiche`.
  - Most adult films get no card (their only match, `bon-age-film-enfant`, is already the
    « Comment lire cet âge ? » link). A teen-oriented article (« 12-16 ans : films et séries »)
    would fill that gap.
  - Watch the Vercel referrers to `/blog/*` from `/media/*` after a week; if the fear article
    over-fires on « Fantastique » titles, raise `FEAR_AXIS_MIN` or drop that genre.
- **Two December drafts written, not published:** `blog/16-jeux-video-noel-selon-age.md`
  (`publishedAt: 2026-12-01`) and `blog/17-gta-6-phenomene-comment-en-parler.md`
  (`publishedAt: 2026-12-04`). No hero image (branded card).
  - **17 was rewritten on 27 Nov 2026** (branch `claude/blogger-gta-phenomene`): Xavier dropped
    the GTA VI « Guide parents » (an 18+ game in the guide template read as « how to let your kid
    play ») for one article, « GTA 6 : pourquoi tous les enfants en parlent, et comment en parler
    avec le vôtre ». Old slug `gta-6-sous-le-sapin` is gone: if a `drafts.post-gta-6-sous-le-sapin`
    exists in Sanity, delete it in /studio.
  - GTA fiches link to 17 **all year** (no season gate); 16 stays seasonal (`src/lib/blog-links.ts`).
  - Every age / PEGI cited was re-read from the catalogue on 27 Nov 2026 (enriched titles only).
    **Age Keeper to re-check before publishing**: ages move.
  - 17 links to 16 (`/blog/jeux-video-noel-selon-age`): publish 16 first, or both together
    (`--publish --only 16,17`); publishing 17 alone fails the link check until 16 is live.
  - Facts in 17 that are not in our catalogue (Leonida / Vice City / Florida, no online mode
    announced, GTA Online's currency sold for real money, the console age restriction) need a
    human check before 4 Dec; the list is in the 27 Nov report to the Director.
  - If Rockstar announces an online mode, update the « Garder le jeu en ligne pour plus tard »
    paragraph.
- **Call of Duty guide reframed (27 Nov 2026, same branch):** « Votre enfant y joue déjà (souvent
  Warzone, gratuit) : voici ce qu'il faut savoir et régler ». « Jouer avec votre enfant » became
  « Poser un cadre ensemble » via the new optional `playTogether.heading`. Three new claims wait
  in `docs/guides-verification.md` (Call of Duty, points 14–16, « À VÉRIFIER »).
- **17 Nov launch:** articles 12 and 09 carry `publishedAt: 2026-11-17` 08:00 Paris. On the
  day (after 08:00), with `SANITY_API_WRITE_TOKEN` in `.env.local`:
  `npx tsx scripts/publish-blog.ts --publish --only 12,09 --dry-run`, then without
  `--dry-run`. The `/blog` indexing, the « Conseils » link and the « Comment lire cet âge ? »
  link switch on by themselves — no redeploy.
- Hero images from `blog/images/demande-images-gpt.md` (procedure in `blog/images/README.md`).
- Unverified figure on the homepage « chiffre de la semaine »: « 60 % des familles… »
  cites « CSA · Baromètre télévision » — find the source or replace it.
