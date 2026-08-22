import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { fetchStephDashboard } from "@/lib/steph/dashboard-data"
import { StephShell } from "@/components/steph/StephShell"
import { StephDashboardView } from "@/components/steph/StephDashboardView"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Tableau de bord — Totem Avisé",
  robots: { index: false, follow: false },
}

export default async function StephDashboardPage() {
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

  const data = await fetchStephDashboard()

  return (
    <StephShell
      active="tableau"
      eyebrow="Tableau de bord"
      title={
        <>
          Comment va{" "}
          <em className="italic" style={{ color: "var(--color-accent)" }}>
            Totem Avisé
          </em>{" "}
          aujourd&apos;hui
        </>
      }
      subtitle="Une page, six sections. On commence par « est-ce que tout va bien ? », puis on descend vers le détail. Aucun bouton de cette page ne modifie quoi que ce soit sur le site."
    >
      <StephDashboardView data={data} now={new Date(data.generatedAt).getTime()} />
    </StephShell>
  )
}
