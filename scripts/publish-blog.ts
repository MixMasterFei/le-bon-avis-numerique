/**
 * Import or publish the blog/NN-*.md drafts in Sanity — the ONE blog importer.
 * (scripts/import-blog-drafts.mjs, which wrote other document ids with another
 * token variable and back-dated the posts, was removed.)
 *
 *   npx tsx scripts/publish-blog.ts --dry-run                      # plan only, writes nothing
 *   npx tsx scripts/publish-blog.ts                                # every draft → Studio drafts
 *   npx tsx scripts/publish-blog.ts --only 12,09                   # only those drafts
 *   npx tsx scripts/publish-blog.ts --publish --only 12,09 --dry-run
 *   npx tsx scripts/publish-blog.ts --publish --only 12,09         # 12 and 09 go live
 *
 * Options
 *   --only <NN|slug>[,…]  posts to handle (number prefix or slug), repeatable.
 *                         Required with --publish: the fifteen never go live at once.
 *   --publish             write the live document post-<slug> and delete its draft,
 *                         like Studio's « Publier ». Default: drafts.post-<slug> only.
 *   --date <date>         publication date for the selected posts, overriding the
 *                         frontmatter: AAAA-MM-JJ (08:00 Paris), "AAAA-MM-JJ HH:MM"
 *                         or ISO. Requires --only.
 *   --allow-past          accept a date before today (deliberate back-dating).
 *   --delete-legacy       delete duplicates left by the old importer
 *                         (blog-<slug>, drafts.blog-<slug>).
 *   --dry-run             print the plan and stop (reads Sanity if a token is set).
 *
 * Dates — each post's date is explicit: frontmatter `publishedAt: "2026-11-17"`
 * or --date. Never computed, never in the past unless --allow-past. A live post
 * dated in the future stays hidden on the site until that time (scheduling); a
 * post already visible keeps its date when re-published.
 *
 * Images — `heroImage: "blog/images/xx.png"` + `heroAlt: "…"` (+ optional
 * `heroCredit: "Illustration générée par IA"`) in the frontmatter uploads the
 * file as mainImage; see blog/images/README.md. Works on a post already live
 * (its date is kept). Without it, an image added in Studio is kept; with
 * neither, the site shows the branded placeholder card /api/blog/card/<slug>.
 *
 * Text — the .md file is the source of truth: re-running replaces title, excerpt
 * and body of the Sanity document (text edited in Studio is overwritten; the
 * image and dates set in Studio are kept).
 *
 * Token — SANITY_API_WRITE_TOKEN (write access to dataset "production") in
 * .env.local, the same variable the admin preview (/admin/apercu-blog) reads.
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { basename, join, resolve, sep } from "node:path"
import { createClient } from "@sanity/client"
import { projectId, dataset, apiVersion } from "../src/sanity/env"
import {
  buildPostDocument,
  checkBlogLinks,
  draftId,
  fmString,
  formatParis,
  heroImageValue,
  internalBlogLinks,
  legacyIds,
  liveId,
  parseFrontmatter,
  resolvePublishDate,
  selectPosts,
  validateFrontmatter,
  type Frontmatter,
  type SanityImageValue,
} from "../src/lib/blog-import"

const ROOT = process.cwd()
const BLOG_DIR = join(ROOT, "blog")
const SITE = "https://totemavise.com"

interface Options {
  dryRun: boolean
  publish: boolean
  only: string[]
  date?: string
  allowPast: boolean
  deleteLegacy: boolean
}

function fail(message: string): never {
  console.error(`\nERREUR : ${message}`)
  process.exit(1)
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { dryRun: false, publish: false, only: [], allowPast: false, deleteLegacy: false }
  for (let i = 0; i < argv.length; i++) {
    const eq = argv[i].indexOf("=")
    const flag = eq === -1 ? argv[i] : argv[i].slice(0, eq)
    const inline = eq === -1 ? undefined : argv[i].slice(eq + 1)
    const value = () => {
      const v = inline ?? argv[++i]
      if (!v || v.startsWith("--")) fail(`${flag} attend une valeur`)
      return v
    }
    switch (flag) {
      case "--dry-run": opts.dryRun = true; break
      case "--publish": opts.publish = true; break
      case "--allow-past": opts.allowPast = true; break
      case "--delete-legacy": opts.deleteLegacy = true; break
      case "--only": opts.only.push(value()); break
      case "--date": opts.date = value(); break
      case "--help":
      case "-h":
        console.log(readFileSync(__filename, "utf8").split("*/")[0].replace(/^\/\*\*?|^ \* ?/gm, ""))
        process.exit(0)
      default:
        fail(`option inconnue « ${argv[i]} » (voir --help)`)
    }
  }
  if (opts.publish && opts.only.length === 0)
    fail("--publish demande --only (ex. --publish --only 12,09) : on ne publie jamais tout le dossier d'un coup")
  if (opts.date && opts.only.length === 0) fail("--date s'applique aux articles choisis avec --only")
  return opts
}

interface ExistingDoc {
  _id: string
  slug?: string
  publishedAt?: string
  mainImage?: SanityImageValue
}

interface PlannedPost {
  file: string
  slug: string
  fm: Frontmatter
  body: string
  publishedAt: string | null
  dateSource: string
  heroFile?: string
  keptImage?: SanityImageValue
  draft?: ExistingDoc
  live?: ExistingDoc
  legacy: ExistingDoc[]
  notes: string[]
  links: string[]
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!existsSync(BLOG_DIR)) fail(`dossier ${BLOG_DIR} introuvable — lancez la commande depuis la racine du dépôt`)

  const errors: string[] = []
  const warnings: string[] = []

  const all = readdirSync(BLOG_DIR)
    .filter((f) => /^\d\d-.+\.md$/.test(f))
    .sort()
    .map((file) => {
      try {
        const { fm, body } = parseFrontmatter(readFileSync(join(BLOG_DIR, file), "utf8"))
        return { file, fm, body, slug: fmString(fm, "slug") }
      } catch (e) {
        errors.push(`${file} : ${e instanceof Error ? e.message : e}`)
        return { file, fm: {} as Frontmatter, body: "", slug: undefined }
      }
    })

  const { selected, unknown } = opts.only.length ? selectPosts(all, opts.only) : { selected: all, unknown: [] }
  if (unknown.length) fail(`--only : « ${unknown.join(", ")} » ne correspond à aucun fichier blog/NN-*.md`)
  if (selected.length === 0) fail("aucun article à traiter")

  const slugCount = new Map<string, number>()
  for (const p of all) if (p.slug) slugCount.set(p.slug, (slugCount.get(p.slug) ?? 0) + 1)

  for (const p of selected) {
    for (const e of validateFrontmatter(p.fm)) errors.push(`${p.file} : ${e}`)
    if (p.slug && (slugCount.get(p.slug) ?? 0) > 1) errors.push(`${p.file} : le slug « ${p.slug} » est utilisé par plusieurs fichiers`)
    const hero = fmString(p.fm, "heroImage")
    if (hero) {
      const abs = resolve(ROOT, hero)
      if (!abs.startsWith(ROOT + sep)) errors.push(`${p.file} : heroImage sort du dépôt`)
      else if (!existsSync(abs) || !statSync(abs).isFile()) errors.push(`${p.file} : heroImage introuvable (${hero})`)
    }
  }
  if (errors.length) {
    console.error("Le frontmatter doit être corrigé avant tout import :")
    for (const e of errors) console.error(`  ✗ ${e}`)
    process.exit(1)
  }

  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!token && !opts.dryRun) {
    fail(
      "SANITY_API_WRITE_TOKEN n'est pas défini (.env.local). Si votre jeton s'appelle SANITY_API_TOKEN " +
        "(variable de l'ancien importeur), renommez-la : c'est aussi celle de l'aperçu /admin/apercu-blog.",
    )
  }
  const client = token ? createClient({ projectId, dataset, apiVersion, token, useCdn: false }) : null

  const slugs = selected.map((p) => p.slug as string)
  const linkTargets = [...new Set(selected.flatMap((p) => internalBlogLinks(p.body)))]
  const ids = slugs.flatMap((s) => [liveId(s), draftId(s), ...legacyIds(s)])
  const existing: ExistingDoc[] = client
    ? (
        await client.fetch<ExistingDoc[]>(
          `*[_type == "post" && (_id in $ids || slug.current in $slugs)]{ _id, "slug": slug.current, publishedAt, mainImage }`,
          { ids, slugs: [...new Set([...slugs, ...linkTargets])] },
          { perspective: "raw" },
        )
      ).filter((d) => !d._id.startsWith("versions."))
    : []

  const now = new Date()
  const mode = opts.publish ? "publish" : "draft"
  const plan: PlannedPost[] = []

  for (const p of selected) {
    const slug = p.slug as string
    const live = existing.find((d) => d._id === liveId(slug))
    const draft = existing.find((d) => d._id === draftId(slug))
    const legacy = existing.filter((d) => legacyIds(slug).includes(d._id))
    const strangers = existing.filter(
      (d) => d.slug === slug && d._id !== liveId(slug) && d._id !== draftId(slug) && !legacyIds(slug).includes(d._id),
    )

    const date = resolvePublishDate({
      mode,
      now,
      allowPast: opts.allowPast,
      cliDate: opts.date,
      frontmatterDate: fmString(p.fm, "publishedAt"),
      liveDate: live?.publishedAt,
      draftDate: draft?.publishedAt,
    })
    if (!date.ok) {
      errors.push(`${p.file} : ${date.error}`)
      continue
    }

    const notes = [...date.notes]
    if (legacy.length) {
      const list = legacy.map((d) => d._id).join(", ")
      if (opts.deleteLegacy) notes.push(`doublon(s) de l'ancien importeur supprimé(s) : ${list}`)
      else if (opts.publish) errors.push(`${p.file} : doublon(s) de l'ancien importeur dans Sanity (${list}) — relancez avec --delete-legacy`)
      else warnings.push(`${p.file} : doublon(s) de l'ancien importeur dans Sanity (${list}) — --delete-legacy pour les supprimer`)
    }
    if (strangers.length) {
      const list = strangers.map((d) => d._id).join(", ")
      const message = `${p.file} : un autre document Sanity porte déjà le slug « ${slug} » (${list}) — supprimez-le dans /studio avant de continuer`
      if (opts.publish) errors.push(message)
      else warnings.push(message)
    }
    if (draft) notes.push("brouillon Sanity existant : texte remplacé par le fichier .md")
    if (opts.publish && draft) notes.push("le brouillon est supprimé après publication (comme « Publier » dans Studio)")

    const heroFile = fmString(p.fm, "heroImage")
    plan.push({
      file: p.file,
      slug,
      fm: p.fm,
      body: p.body,
      publishedAt: date.publishedAt,
      dateSource: date.source,
      heroFile,
      keptImage: heroFile ? undefined : (draft?.mainImage ?? live?.mainImage),
      draft,
      live,
      legacy,
      notes,
      links: internalBlogLinks(p.body).filter((l) => l !== slug),
    })
  }

  if (opts.publish && errors.length === 0) {
    const batch = new Set(slugs)
    errors.push(
      ...checkBlogLinks({
        posts: plan.map((p) => ({ slug: p.slug, publishedAt: p.publishedAt as string, links: p.links })),
        existingLive: existing.filter((d) => !d._id.startsWith("drafts.") && d.slug && !batch.has(d.slug)) as { slug: string; publishedAt?: string }[],
      }),
    )
  }

  // ── Plan ──
  console.log(
    `\n${opts.publish ? "PUBLICATION — documents publics post-<slug>" : "BROUILLONS — drafts.post-<slug>, invisibles sur le site"}` +
      ` · Sanity ${projectId}/${dataset}` +
      (client ? "" : " · non consulté (pas de jeton) : plan théorique"),
  )
  for (const p of plan) {
    const id = opts.publish ? liveId(p.slug) : draftId(p.slug)
    const when = p.publishedAt
      ? `${formatParis(new Date(p.publishedAt))} (Paris) — ${p.dateSource}`
      : "aucune — à choisir dans Studio avant de publier"
    const image = p.heroFile
      ? `à téléverser : ${p.heroFile}`
      : p.keptImage
        ? "conservée (déjà dans Sanity)"
        : `carte Totem ${SITE}/api/blog/card/${p.slug}`
    console.log(`\n  ${p.file}\n    → ${id}\n    date  : ${when}\n    image : ${image}`)
    if (p.links.length) console.log(`    liens : ${p.links.map((l) => `/blog/${l}`).join(", ")}`)
    for (const n of p.notes) console.log(`    · ${n}`)
  }
  for (const w of warnings) console.warn(`\n  ⚠ ${w}`)
  if (errors.length) {
    console.error("\nRien n'a été écrit :")
    for (const e of errors) console.error(`  ✗ ${e}`)
    process.exit(1)
  }
  if (opts.dryRun || !client) {
    console.log("\nSimulation (--dry-run) : rien n'a été écrit.")
    return
  }

  // ── Write: uploads first, then one transaction (all posts or none) ──
  const images = new Map<string, SanityImageValue>()
  for (const p of plan) {
    if (!p.heroFile) continue
    const abs = resolve(ROOT, p.heroFile)
    // Sanity dedupes assets by content: re-running with the same file reuses it.
    const asset = await client.assets.upload("image", readFileSync(abs), { filename: basename(abs) })
    images.set(p.slug, heroImageValue(asset._id, p.fm))
    console.log(`  image téléversée pour ${p.slug} (${asset._id})`)
  }

  const tx = client.transaction()
  for (const p of plan) {
    const doc = buildPostDocument({
      id: opts.publish ? liveId(p.slug) : draftId(p.slug),
      fm: p.fm,
      body: p.body,
      publishedAt: p.publishedAt,
      mainImage: images.get(p.slug) ?? p.keptImage ?? null,
    })
    tx.createOrReplace(doc)
    if (opts.publish && p.draft) tx.delete(draftId(p.slug))
    if (opts.deleteLegacy) for (const d of p.legacy) tx.delete(d._id)
  }
  await tx.commit({ visibility: "sync" })

  if (opts.publish) {
    console.log(`\n${plan.length} article(s) publié(s) :`)
    for (const p of plan) {
      const at = new Date(p.publishedAt as string)
      const visible = at.getTime() <= Date.now() ? "visible d'ici quelques minutes" : `visible à partir du ${formatParis(at)} (Paris)`
      console.log(`  ${SITE}/blog/${p.slug} — ${visible}`)
    }
  } else {
    console.log(`\n${plan.length} brouillon(s) écrit(s). Relecture : ${SITE}/admin/apercu-blog ou ${SITE}/studio`)
  }
}

main().catch((e) => {
  console.error("\nÉchec :", e instanceof Error ? e.message : e)
  process.exit(1)
})
