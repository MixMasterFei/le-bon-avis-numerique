import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recommandations — Films et séries adaptés à votre famille",
  description: "Trouvez des films, séries et jeux adaptés à l'âge et aux sensibilités de votre famille grâce à notre moteur de recommandations personnalisées.",
  alternates: { canonical: "/recommandations" },
  openGraph: {
    title: "Recommandations personnalisées | Totem Avisé",
    description: "Trouvez des films, séries et jeux adaptés à l'âge et aux sensibilités de votre famille.",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "Totem Avisé" }],
  },
}

export default function RecommandationsLayout({ children }: { children: React.ReactNode }) {
  return children
}
