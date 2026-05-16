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
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_SEED !== "true") {
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
      dataQualityScore: 80,
      isEnriched: true,
    },
    update: {
      genres: ["Horreur", "Thriller"],
      expertAgeRec: 16,
      posterUrl: "https://image.tmdb.org/t/p/w500/placeholder.jpg",
      tmdbVoteCount: 2000,
      tmdbRating: 7.5,
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
    },
    update: {
      violence: 4,
      sexNudity: 1,
      positiveMessages: 1,
      roleModels: 1,
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
      dataQualityScore: 90,
      isEnriched: true,
    },
    update: {
      genres: ["Animation", "Famille", "Aventure"],
      expertAgeRec: 6,
      posterUrl: "https://image.tmdb.org/t/p/w500/placeholder-family.jpg",
      tmdbVoteCount: 4500,
      tmdbRating: 8.1,
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
    },
    update: {
      violence: 1,
      positiveMessages: 4,
      roleModels: 4,
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
