import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recommandations personnalisées",
  description:
    "Trouvez des films, séries et jeux adaptés à l'âge de votre enfant grâce à notre outil de recommandation interactif.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/recommandations" },
}

export default function RecommandationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
