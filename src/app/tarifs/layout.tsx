import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tarifs — Totem Avisé",
  description:
    "Découvrez l'accès gratuit à Totem Avisé et les fonctionnalités premium prévues pour les familles qui veulent aller plus loin.",
  alternates: { canonical: "/tarifs" },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Tarifs — Totem Avisé",
    description:
      "Découvrez l'accès gratuit à Totem Avisé et les fonctionnalités premium prévues pour les familles qui veulent aller plus loin.",
    type: "website",
    locale: "fr_FR",
    siteName: "Totem Avisé",
  },
}

export default function TarifsLayout({ children }: { children: React.ReactNode }) {
  return children
}
