import type { Metadata } from "next"
import { ApercuInscription } from "@/components/home-v2/ApercuInscription"

export const metadata: Metadata = {
  title: "Inscription",
  description:
    "Rejoignez les familles qui choisissent leurs films, séries et jeux en confiance. Inscription gratuite, sans recommandation opaque.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/inscription" },
  openGraph: {
    title: "Créer un compte famille | Totem Avisé",
    description:
      "Créez votre profil famille pour obtenir des repères par âge, par goûts et par sensibilités.",
    url: "https://totemavise.com/inscription",
    type: "website",
    locale: "fr_FR",
    siteName: "Totem Avisé",
  },
}

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>
}) {
  // callbackUrl is read here, server-side, and passed down: the form ships in
  // the HTML. (It used to read useSearchParams() inside a Suspense boundary with
  // no fallback, so the whole form appeared only after hydration — CLS 0.25.)
  const { callbackUrl } = await searchParams
  return (
    <ApercuInscription
      serifClass="font-serif"
      callbackUrl={Array.isArray(callbackUrl) ? callbackUrl[0] : callbackUrl}
    />
  )
}
