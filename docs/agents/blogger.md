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

## Open work (2026-11-06)
- **17 Nov launch:** articles 12 and 09 carry `publishedAt: 2026-11-17` 08:00 Paris. On the
  day (after 08:00), with `SANITY_API_WRITE_TOKEN` in `.env.local`:
  `npx tsx scripts/publish-blog.ts --publish --only 12,09 --dry-run`, then without
  `--dry-run`. The `/blog` indexing, the « Conseils » link and the « Comment lire cet âge ? »
  link switch on by themselves — no redeploy.
- Hero images from `blog/images/demande-images-gpt.md` (procedure in `blog/images/README.md`).
- Unverified figure on the homepage « chiffre de la semaine »: « 60 % des familles… »
  cites « CSA · Baromètre télévision » — find the source or replace it.
