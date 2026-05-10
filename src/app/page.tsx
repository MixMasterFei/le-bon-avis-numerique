import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"
import { HomepageApercu } from "@/components/home-v2/HomepageApercu"
import { ApercuTimeAwareHero } from "@/components/home-v2/ApercuTimeAwareHero"

/**
 * Picks the age cap the time-aware hero should respect.
 *
 * Rule (per product): if the logged-in user has family members,
 * use the YOUNGEST minor's age. The "en famille" framing means
 * "everyone in the room can watch together", so the smallest
 * viewer defines the ceiling. Older siblings discover content
 * elsewhere on the site, not in this co-viewing rail. Adult
 * members (18+) are ignored. No family or no minors → null
 * (caller falls back to FAMILY_AGE_CAP).
 */
async function resolveFamilyAgeCap(userId: string): Promise<number | null> {
  try {
    const members = await prisma.familyMember.findMany({
      where: { userId },
      select: { birthYear: true, birthMonth: true },
    })
    if (members.length === 0) return null
    const ages = members
      .map((m) => getMemberAge(m.birthYear, m.birthMonth))
      .filter((a): a is number => typeof a === "number" && a >= 0 && a < 18)
    if (ages.length === 0) return null
    return Math.min(...ages)
  } catch {
    return null
  }
}

export default async function HomePage() {
  const session = await auth()
  const isLoggedIn = !!session?.user
  const isAdmin = session?.user?.role === "ADMIN"

  const maxAgeCap = session?.user?.id ? await resolveFamilyAgeCap(session.user.id) : null

  // Time-aware hero is built server-side here and passed down as a
  // slot. HomepageApercu is "use client", so async server components
  // can't be imported there directly — only composed in via prop.
  const topSlot = (
    <ApercuTimeAwareHero serifClass="font-serif" maxAgeCap={maxAgeCap} />
  )

  return (
    <HomepageApercu
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      serifClass="font-serif"
      topSlot={topSlot}
    />
  )
}
