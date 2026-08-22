import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { StephShell } from "@/components/steph/StephShell"
import { StephMindmapView } from "@/components/steph/StephMindmapView"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "La carte — Totem Avisé",
  robots: { index: false, follow: false },
}

export default async function StephCartePage() {
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

  return (
    <StephShell
      active="carte"
      eyebrow="La carte mentale"
      title={
        <>
          Tout le projet sur{" "}
          <em className="italic" style={{ color: "var(--color-accent)" }}>
            une seule page
          </em>
        </>
      }
      subtitle="Sept branches, du produit jusqu'au marketing. Cliquez sur une branche du schéma pour la déplier. Les pastilles de couleur disent où on en est : en place, en cours, ou à faire."
    >
      <StephMindmapView />
    </StephShell>
  )
}
