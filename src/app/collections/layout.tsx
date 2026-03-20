import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Collections — Sélections thématiques pour toute la famille",
  description: "Découvrez nos collections thématiques : les meilleurs films, séries et jeux pour enfants et ados, sélectionnés et analysés par des experts.",
  alternates: { canonical: "/collections" },
  openGraph: {
    title: "Collections — Sélections thématiques | Totem Avisé",
    description: "Découvrez nos collections thématiques : les meilleurs films, séries et jeux pour enfants et ados.",
    images: [{ url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" }],
  },
}

export default function CollectionsLayout({ children }: { children: React.ReactNode }) {
  return children
}
