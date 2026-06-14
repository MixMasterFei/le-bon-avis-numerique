import dynamic from "next/dynamic"
import { auth } from "@/lib/auth"
import { RechercheClassic } from "./RechercheClassic"

// Admin-only V2 search, code-split so its chunk + fonts stay out of the public
// bundle. Public + ?v=classic get the existing client search page.
const RechercheV2 = dynamic(() =>
  import("./RechercheV2").then((m) => m.RechercheV2),
)

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RecherchePage({ searchParams }: PageProps) {
  const params = await searchParams
  const session = await auth()
  const isAdmin =
    (session?.user as { role?: string } | undefined)?.role === "ADMIN"
  const v = typeof params.v === "string" ? params.v : undefined
  const showV2 = isAdmin && v !== "classic"

  return showV2 ? <RechercheV2 /> : <RechercheClassic />
}
