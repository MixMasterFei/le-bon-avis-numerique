import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { canUseNlSearch } from "@/lib/nl-search/access"
import { DecouverteResults } from "./DecouverteResults"
import { DecouverteSkeleton } from "./DecouverteSkeleton"
import type { NlSearchParams } from "@/lib/nl-search/validate"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Recherche magique | Totem Avisé",
  description: "Décrivez ce que vous cherchez, nous composons une sélection adaptée à votre famille.",
  // Query pages are per-visitor and unbounded in number — they must never
  // compete with the fiches in search results. `follow` keeps the links to
  // those fiches useful to crawlers.
  robots: { index: false, follow: true },
}

export default async function DecouvertePage({
  searchParams,
}: {
  searchParams?: Promise<NlSearchParams>
}) {
  const session = await auth()
  const params = (await searchParams) ?? {}

  // Gate fails (kill switch, or the flag hasn't reached this visitor): send
  // them to the classic search with their question intact rather than a 404.
  if (!canUseNlSearch({ isAuthenticated: !!session?.user, role: session?.user?.role })) {
    const q = typeof params.q === "string" ? params.q : ""
    redirect(q ? `/recherche?q=${encodeURIComponent(q)}` : "/recherche")
  }

  return (
    <Suspense fallback={<DecouverteSkeleton query={typeof params.q === "string" ? params.q : ""} />}>
      <DecouverteResults params={params} userId={session?.user?.id ?? null} />
    </Suspense>
  )
}
