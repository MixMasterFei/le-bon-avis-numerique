import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"

// Dev-only seed route. Guarded by NODE_ENV so it cannot run in production.
// Creates (or upserts) a deterministic test user with two family members and
// one known horror movie + one family movie, used by the Playwright family-fit
// E2E specs. Returns the ids so tests can pin against them.

const TEST_EMAIL = "totem-test-family@example.com"
const TEST_PASSWORD = "Totem!E2E-2026"
const TEST_HORROR_ID = "11111111-1111-4111-8111-111111111111"
const TEST_FAMILY_MOVIE_ID = "22222222-2222-4222-8222-222222222222"

export async function POST() {
  // This route seeds deterministic E2E fixtures. It must NEVER write to the
  // production database. Two independent guards, either of which requires an
  // explicit ALLOW_TEST_SEED="true" opt-in:
  //   1. NODE_ENV === "production" — the Vercel runtime (original guard).
  //   2. DATABASE_URL points at a hosted Supabase pooler — catches the real
  //      incident: a LOCAL `npm run dev` whose .env points at prod. There
  //      NODE_ENV is "development", so guard #1 alone let a local Playwright
  //      run seed prod. CI uses an isolated localhost Postgres container (and
  //      opts in via ALLOW_TEST_SEED), so it is unaffected.
  const dbUrl = process.env.DATABASE_URL ?? ""
  const looksLikeHostedDb = /supabase\.(co|com)/i.test(dbUrl)
  const guarded = process.env.NODE_ENV === "production" || looksLikeHostedDb
  if (guarded && process.env.ALLOW_TEST_SEED !== "true") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 })
  }

  const passwordHash = await hash(TEST_PASSWORD, 10)
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    create: {
      email: TEST_EMAIL,
      name: "Famille Test",
      password: passwordHash,
      emailVerified: new Date(),
      onboardingCompleted: true,
    },
    update: {
      password: passwordHash,
      emailVerified: new Date(),
    },
  })

  const currentYear = new Date().getUTCFullYear()

  // Wipe + recreate the family members so each E2E run starts from a known state.
  await prisma.familyMember.deleteMany({ where: { userId: user.id } })

  const child = await prisma.familyMember.create({
    data: {
      userId: user.id,
      name: "Léo",
      birthYear: currentYear - 10,
      birthMonth: 6,
      avatarEmoji: "🧒",
      favoriteGenres: ["Animation", "Aventure"],
      dislikedGenres: ["Horreur", "Thriller"],
      sensitivityViolence: 2,
      sensitivityScary: 3,
      sensitivitySexual: 3,
      sensitivityLanguage: 2,
      sensitivitySubstances: 2,
      preferPositiveMessages: 2,
      preferRoleModels: 2,
      preferEducational: 1,
      avoidTopics: [],
      interests: ["Espace", "Animaux"],
      useCustomSettings: true,
    },
  })

  const sibling = await prisma.familyMember.create({
    data: {
      userId: user.id,
      name: "Manon",
      birthYear: currentYear - 6,
      birthMonth: 3,
      avatarEmoji: "👧",
      favoriteGenres: ["Animation", "Famille"],
      dislikedGenres: ["Horreur"],
      sensitivityViolence: 3,
      sensitivityScary: 3,
      sensitivitySexual: 3,
      sensitivityLanguage: 3,
      sensitivitySubstances: 3,
      preferPositiveMessages: 2,
      preferRoleModels: 2,
      preferEducational: 2,
      avoidTopics: [],
      interests: ["Princesses", "Animaux"],
      useCustomSettings: true,
    },
  })

  // Seed a horror title and a family title with deterministic ids so specs can
  // navigate to /media/<id> directly.
  await prisma.mediaItem.upsert({
    where: { id: TEST_HORROR_ID },
    create: {
      id: TEST_HORROR_ID,
      title: "Test Horror Movie (E2E)",
      type: "MOVIE",
      releaseDate: new Date("2020-10-01"),
      posterUrl: "https://image.tmdb.org/t/p/w500/placeholder.jpg",
      synopsisFr: "Un film de test utilisé par la suite E2E pour vérifier les filtres de genre.",
      expertAgeRec: 16,
      genres: ["Horreur", "Thriller"],
      platforms: [],
      topics: ["Fantômes"],
      originalLanguage: "fr",
      tmdbRating: 7.5,
      tmdbVoteCount: 2000,
      // DQS 0 keeps these fixtures below every public/browse/featured floor
      // (publicMediaWhere requires >= 30) so a stray seed can never surface
      // them; the E2E specs navigate to /media/<id> by id, which has no DQS
      // gate, so they still work.
      dataQualityScore: 0,
      isEnriched: true,
    },
    update: {
      genres: ["Horreur", "Thriller"],
      expertAgeRec: 16,
      posterUrl: "https://image.tmdb.org/t/p/w500/placeholder.jpg",
      tmdbVoteCount: 2000,
      tmdbRating: 7.5,
      dataQualityScore: 0,
    },
  })

  await prisma.contentMetrics.upsert({
    where: { mediaId: TEST_HORROR_ID },
    create: {
      mediaId: TEST_HORROR_ID,
      violence: 4,
      sexNudity: 1,
      language: 2,
      consumerism: 0,
      substanceUse: 1,
      positiveMessages: 1,
      roleModels: 1,
      whatParentsNeedToKnow: [],
      // High confidence + not-flagged keeps the nightly deep-enrich cron
      // (which targets needsDeepEnrich: true) from ever re-processing a
      // fixture and burning API calls on placeholder data.
      enrichmentConfidence: 1.0,
      needsDeepEnrich: false,
    },
    update: {
      violence: 4,
      sexNudity: 1,
      positiveMessages: 1,
      roleModels: 1,
      enrichmentConfidence: 1.0,
      needsDeepEnrich: false,
    },
  })

  await prisma.mediaItem.upsert({
    where: { id: TEST_FAMILY_MOVIE_ID },
    create: {
      id: TEST_FAMILY_MOVIE_ID,
      title: "Test Family Movie (E2E)",
      type: "MOVIE",
      releaseDate: new Date("2022-06-01"),
      posterUrl: "https://image.tmdb.org/t/p/w500/placeholder-family.jpg",
      synopsisFr: "Un film familial test utilisé par la suite E2E.",
      expertAgeRec: 6,
      genres: ["Animation", "Famille", "Aventure"],
      platforms: [],
      topics: ["Animaux", "Amitié"],
      originalLanguage: "fr",
      tmdbRating: 8.1,
      tmdbVoteCount: 4500,
      // DQS 0 — see the horror fixture above.
      dataQualityScore: 0,
      isEnriched: true,
    },
    update: {
      genres: ["Animation", "Famille", "Aventure"],
      expertAgeRec: 6,
      posterUrl: "https://image.tmdb.org/t/p/w500/placeholder-family.jpg",
      tmdbVoteCount: 4500,
      tmdbRating: 8.1,
      dataQualityScore: 0,
    },
  })

  await prisma.contentMetrics.upsert({
    where: { mediaId: TEST_FAMILY_MOVIE_ID },
    create: {
      mediaId: TEST_FAMILY_MOVIE_ID,
      violence: 1,
      sexNudity: 0,
      language: 0,
      consumerism: 1,
      substanceUse: 0,
      positiveMessages: 4,
      roleModels: 4,
      whatParentsNeedToKnow: [],
      enrichmentConfidence: 1.0,
      needsDeepEnrich: false,
    },
    update: {
      violence: 1,
      positiveMessages: 4,
      roleModels: 4,
      enrichmentConfidence: 1.0,
      needsDeepEnrich: false,
    },
  })

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: TEST_EMAIL, password: TEST_PASSWORD },
    members: {
      child: { id: child.id, name: child.name, age: currentYear - (child.birthYear ?? 0) },
      sibling: { id: sibling.id, name: sibling.name, age: currentYear - (sibling.birthYear ?? 0) },
    },
    media: {
      horror: { id: TEST_HORROR_ID },
      family: { id: TEST_FAMILY_MOVIE_ID },
    },
  })
}
