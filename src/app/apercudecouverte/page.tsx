import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { fetchDiscoverDigest } from "@/lib/discover-digest"
import { factOfTheWeek } from "@/lib/family-facts"
import { DecouverteDigest } from "@/components/home-v2/DecouverteDigest"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces } from "@/components/home-v2/apercuTheme"

export const dynamic = "force-dynamic"
export const revalidate = 60 // page is fully RSC, 1-min ISR is enough

interface SearchParams {
  font?: string
}

export default async function ApercuDecouvertePage(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/connexion?next=/apercudecouverte")
  }
  if (!session?.user?.id) {
    redirect("/connexion?next=/apercudecouverte")
  }
  const role = (session.user as { role?: string }).role
  const canRefresh = role === "ADMIN" || role === "MODERATOR"

  const [digest, searchParams] = await Promise.all([
    fetchDiscoverDigest(),
    props.searchParams,
  ])
  const fact = factOfTheWeek()

  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <DecouverteDigest
        digest={digest}
        fact={fact}
        serifClass={serifClass}
        canRefresh={canRefresh}
      />
    </div>
  )
}
