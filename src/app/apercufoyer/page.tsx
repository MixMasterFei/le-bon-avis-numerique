import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ApercuFoyer } from "@/components/home-v2/ApercuFoyer"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces } from "@/components/home-v2/apercuTheme"

const OWNER_EMAIL = "masterfei@gmail.com"

interface SearchParams {
  font?: string
}

export default async function ApercuFoyerPage(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/")
  }

  const user = session?.user as
    | { id?: string; email?: string | null; role?: string; name?: string | null; image?: string | null }
    | undefined
  const isOwner = user?.email === OWNER_EMAIL || user?.role === "ADMIN"
  if (!isOwner || !user?.id) redirect("/")

  // Fetch real foyer data: user profile + family members + stats
  const [dbUser, members, reactionCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        avatarStyle: true,
        avatarSeed: true,
        avatarOptions: true,
        createdAt: true,
      },
    }),
    prisma.familyMember.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { reactions: true } },
      },
    }),
    prisma.mediaReaction.count({
      where: { familyMember: { userId: user.id } },
    }),
  ])

  if (!dbUser) redirect("/")

  const searchParams = await props.searchParams
  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

  const foyerForClient = {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      image: dbUser.image,
      avatarStyle: dbUser.avatarStyle,
      avatarSeed: dbUser.avatarSeed,
      avatarOptions: dbUser.avatarOptions as Record<string, unknown> | null,
      memberSince: dbUser.createdAt.toISOString(),
    },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      birthYear: m.birthYear,
      birthMonth: m.birthMonth,
      avatarEmoji: m.avatarEmoji,
      avatarStyle: m.avatarStyle,
      avatarSeed: m.avatarSeed,
      avatarOptions: m.avatarOptions as Record<string, unknown> | null,
      interests: m.interests ?? [],
      favoriteGenres: m.favoriteGenres ?? [],
      useCustomSettings: m.useCustomSettings,
      sensitivityViolence: m.sensitivityViolence,
      sensitivityScary: m.sensitivityScary,
      reactionCount: m._count?.reactions ?? 0,
    })),
    totalReactions: reactionCount,
  }

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <ApercuFoyer data={foyerForClient} serifClass={serifClass} />
    </div>
  )
}
