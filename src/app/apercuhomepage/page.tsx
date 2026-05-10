import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMemberAge } from "@/lib/age-utils"
import { ApercuHomepageV2 } from "@/components/home-v2/ApercuHomepageV2"
import { ApercuTimeAwareHero } from "@/components/home-v2/ApercuTimeAwareHero"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces } from "@/components/home-v2/apercuTheme"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Aperçu homepage · Totem Avisé",
  robots: { index: false, follow: false },
}

const OWNER_EMAIL = "masterfei@gmail.com"

interface SearchParams {
  font?: string
}

async function resolveFamilyAgeCap(userId: string): Promise<number | null> {
  try {
    const members = await prisma.familyMember.findMany({
      where: { userId },
      select: { birthYear: true, birthMonth: true },
    })
    if (members.length === 0) return null
    const ages = members
      .map((member) => getMemberAge(member.birthYear, member.birthMonth))
      .filter((age): age is number => typeof age === "number" && age >= 0 && age < 18)
    if (ages.length === 0) return null
    return Math.min(...ages)
  } catch {
    return null
  }
}

export default async function ApercuHomepagePage(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/")
  }

  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined
  const isOwner = user?.email === OWNER_EMAIL || user?.role === "ADMIN"
  if (!isOwner) redirect("/")

  const searchParams = await props.searchParams
  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces ? fraunces.className : "font-[var(--font-heading)]"
  const maxAgeCap = user?.id ? await resolveFamilyAgeCap(user.id) : null

  const topSlot = (
    <ApercuTimeAwareHero serifClass={serifClass} maxAgeCap={maxAgeCap} />
  )

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <ApercuHomepageV2 isLoggedIn={!!session?.user} serifClass={serifClass} topSlot={topSlot} />
    </div>
  )
}
