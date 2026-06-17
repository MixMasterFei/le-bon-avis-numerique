/**
 * Read-only diagnostic: why is a family member's fit stuck on "à vérifier"?
 *
 * Prints, per family member, the fields that drive the rating gate
 * (useCustomSettings / favoriteGenres / dislikedGenres / interests) plus quiz
 * metadata, so you can see at a glance who has actionable preferences. Touches
 * nothing — pure SELECTs.
 *
 * Usage (needs DATABASE_URL — run `vercel env pull` first; it writes .env.local):
 *   npx tsx scripts/check-family-quiz.ts                     # default account
 *   npx tsx scripts/check-family-quiz.ts someone@example.com # by email
 *   npx tsx scripts/check-family-quiz.ts --locate            # find the real
 *       family by member names (the live family is xsmanza@gmail.com, distinct
 *       from the masterfei@gmail.com "Xavier Admin" seed account).
 */

import { config } from "dotenv"
// `vercel env pull` writes to .env.local by default; fall back to .env.
config({ path: ".env.local" })
config()

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Standalone mirror of hasActionablePreferences() in
// src/lib/family-fit-score.ts (the canonical definition — keep in sync). It's
// duplicated here, not imported, because the lib pulls in `@/`-aliased modules
// that tsx doesn't resolve for a bare script run. The gate, when false, caps
// every fit to "moderate / À affiner avec le quiz famille".
function hasActionablePreferences(m: {
  useCustomSettings: boolean
  favoriteGenres: string[]
  dislikedGenres?: string[]
  interests?: string[]
}): boolean {
  return (
    !!m.useCustomSettings ||
    (m.favoriteGenres?.length ?? 0) > 0 ||
    (m.dislikedGenres?.length ?? 0) > 0 ||
    (m.interests?.length ?? 0) > 0
  )
}

async function resolveUserId(arg: string | undefined): Promise<{ id: string; name: string | null; email: string }> {
  // `--locate` finds the account whose family contains the most of these
  // distinctive member names (your real family), so we don't have to guess the
  // login email. Otherwise treat the arg as an email (default: the admin acct).
  if (arg === "--locate") {
    const NAMES = ["Stéphanie", "Eliott", "Erwan", "Mathis", "Xavier"]
    const matches = await prisma.familyMember.findMany({
      where: { name: { in: NAMES } },
      select: { userId: true, user: { select: { id: true, name: true, email: true } } },
    })
    const counts = new Map<string, { user: { id: string; name: string | null; email: string }; n: number }>()
    for (const m of matches) {
      const c = counts.get(m.userId) ?? { user: m.user, n: 0 }
      c.n += 1
      counts.set(m.userId, c)
    }
    const best = [...counts.values()].sort((a, b) => b.n - a.n)[0]
    if (!best) throw new Error("Aucune famille trouvée pour ces prénoms")
    console.log(`(localisé : ${best.n} prénoms correspondants)\n`)
    return best.user
  }

  const email = arg || "masterfei@gmail.com"
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  })
  if (!user) throw new Error(`Aucun utilisateur avec l'email ${email}`)
  return user
}

async function main() {
  const user = await resolveUserId(process.argv[2])

  const members = await prisma.familyMember.findMany({
    where: { userId: user.id },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      name: true,
      birthYear: true,
      useCustomSettings: true,
      favoriteGenres: true,
      dislikedGenres: true,
      interests: true,
      quizVersion: true,
      quizCompletedAt: true,
    },
  })

  console.log(`\nCompte : ${user.name ?? "(sans nom)"} <${user.email}> — ${members.length} membre(s)\n`)

  for (const m of members) {
    const actionable = hasActionablePreferences(m)
    console.log(`■ ${m.name}  (né ${m.birthYear ?? "?"})`)
    console.log(`    useCustomSettings : ${m.useCustomSettings}`)
    console.log(`    favoriteGenres    : ${m.favoriteGenres.length} ${m.favoriteGenres.length ? `[${m.favoriteGenres.join(", ")}]` : "(vide)"}`)
    console.log(`    dislikedGenres    : ${m.dislikedGenres.length} ${m.dislikedGenres.length ? `[${m.dislikedGenres.join(", ")}]` : "(vide)"}`)
    console.log(`    interests         : ${m.interests.length}`)
    console.log(`    quizVersion       : ${m.quizVersion}`)
    console.log(`    quizCompletedAt   : ${m.quizCompletedAt ? m.quizCompletedAt.toISOString() : "(jamais)"}`)
    console.log(`    → actionable prefs: ${actionable ? "OUI ✅ (note normale)" : 'NON ❌ → "à vérifier / À affiner avec le quiz famille"'}`)
    console.log("")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
