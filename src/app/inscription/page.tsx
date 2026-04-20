import type { Metadata } from "next"
import { ApercuInscription } from "@/components/home-v2/ApercuInscription"

export const metadata: Metadata = {
  title: "Inscription",
  description:
    "Rejoignez les familles qui choisissent leurs films, séries et jeux en confiance. Inscription gratuite, sans publicité.",
}

export default function InscriptionPage() {
  return <ApercuInscription serifClass="font-serif" />
}
