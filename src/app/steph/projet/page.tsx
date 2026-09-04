import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { LiveValues } from "@/lib/steph/knowledge"
import { StephShell } from "@/components/steph/StephShell"
import { StephDeckView } from "@/components/steph/StephDeckView"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Le projet — Totem Avisé",
  robots: { index: false, follow: false },
}

/**
 * Les chiffres cités dans la présentation sont lus dans la base à chaque
 * ouverture. Un document de présentation dont les chiffres sont figés dans le
 * texte devient faux au bout de quelques semaines — et un chiffre faux
 * décrédibilise tout le reste du document.
 */
async function fetchLiveValues(): Promise<LiveValues> {
  const [catalogueTotal, movies, series, games, analysed, accounts, members, newsTotal] =
    await Promise.all([
      prisma.mediaItem.count(),
      prisma.mediaItem.count({ where: { type: "MOVIE" } }),
      prisma.mediaItem.count({ where: { type: "TV" } }),
      prisma.mediaItem.count({ where: { type: "GAME" } }),
      prisma.mediaItem.count({ where: { isEnriched: true } }),
      prisma.user.count(),
      prisma.familyMember.count(),
      prisma.newsStory.count({ where: { status: "PUBLISHED" } }).catch(() => 0),
    ])

  return { catalogueTotal, movies, series, games, analysed, accounts, members, newsTotal }
}

export default async function StephProjetPage() {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/")
  }
  const role = (session?.user as { role?: string } | undefined)?.role
  if (role !== "ADMIN" && role !== "MODERATOR") {
    redirect("/")
  }

  const live = await fetchLiveValues()

  return (
    <StephShell
      active="projet"
      eyebrow="Le projet, en détail"
      title={
        <>
          Tout ce qu&apos;il faut savoir sur{" "}
          <em className="italic" style={{ color: "var(--color-accent)" }}>
            Totem Avisé
          </em>
        </>
      }
      subtitle="Douze chapitres, à lire dans l'ordre ou à picorer. On part de « c'est quoi » et on finit par le vocabulaire maison. Comptez une vingtaine de minutes pour tout lire."
    >
      <StephDeckView live={live} />
    </StephShell>
  )
}
