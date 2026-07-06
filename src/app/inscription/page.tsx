import { Suspense } from "react"
import type { Metadata } from "next"
import { ApercuInscription } from "@/components/home-v2/ApercuInscription"

export const metadata: Metadata = {
  title: "Inscription",
  description:
    "Rejoignez les familles qui choisissent leurs films, séries et jeux en confiance. Inscription gratuite, sans recommandation opaque.",
  alternates: { canonical: "/inscription" },
  openGraph: {
    title: "Créer un compte famille | Totem Avisé",
    description:
      "Créez votre profil famille pour obtenir des repères par âge, par goûts et par sensibilités.",
    type: "website",
    locale: "fr_FR",
    siteName: "Totem Avisé",
  },
}

export default function InscriptionPage() {
  // Suspense: ApercuInscription reads useSearchParams() (callbackUrl) — the
  // boundary keeps the page statically prerenderable, same as /connexion.
  return (
    <Suspense>
      <ApercuInscription serifClass="font-serif" />
    </Suspense>
  )
}
