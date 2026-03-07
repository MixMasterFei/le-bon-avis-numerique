import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Films — Avis et âges recommandés pour la famille",
  description: "Les meilleurs films pour votre famille : analyses détaillées, violence, langage, messages positifs. Recommandations d'âge par des experts.",
  alternates: { canonical: "/films" },
  openGraph: {
    title: "Films — Avis et âges recommandés pour la famille | Totem Avisé",
    description: "Les meilleurs films pour votre famille : analyses détaillées, violence, langage, messages positifs.",
    images: [{ url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" }],
  },
}

export default function FilmsLayout({ children }: { children: React.ReactNode }) {
  return children
}
